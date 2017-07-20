var _ = require('underscore')
var apiGen = require('./api')
var jsYaml = require("js-yaml")

function GameState(data) {
  data.timers = data.timers || {}

//at the moment, commands that are are a substring of other commands should be placed after the longer command. ie. "Look around" and "look at" before "look"
  data.commandList = [ "give", "ask", "combine", "look at", "look around", "use", "pick up",
  "take",  "open", "close", "push", "pull", "talk to", "end conversation", "leave", "goodbye", "look",
  "inventory", "help",  "climb", "decend", "save", "load",  "go", "exit", 'list', "examine", "inspect", "get"]
  data.items = data.items || []
  var actionAliases = []
  data.items.forEach(item => {
    item.actions = item.actions || []
    item.flags = {}
    _(item.actions).each((action) => {
      action.aliases = action.aliases || []
      action.aliases = action.aliases.map(a => a.trim())
      actionAliases = actionAliases.concat(action.aliases)
    })
  })
  data.commandList = data.commandList.concat(actionAliases)

  _(data.combinations).each(comb => {
    var map = {}
    _.each(comb.aliasGrammars, item => map[item.name.toLowerCase().trim()] = item.order)
    comb.aliasGrammars = map
  })

  data.combineAliases = []
  _(data.combinations).each((comb)=>{
    data.combineAliases = data.combineAliases.concat(Object.keys(comb.aliasGrammars))
  })
  data.combineAliases = _.uniq(data.combineAliases.map(item => item.toLowerCase()))
  data.commandList = data.commandList.concat(data.combineAliases)
  data.inventory = data.inventory || []

  //convert scene's item list from ids to names
  var mapping = {}
  _(data.items).each(item => mapping[item.id] = item.name)
  _(data.parts).each(part => {
    _(part.sceneList).each(scene => {
      if(scene.items){
        scene.items = scene.items.map(id => mapping[id])
      }
    })
  })

  // _(data.items).each(item =>{
  //   var map = {}
  //   _(item.topics).each(topic => map[topic.name.toLowerCase().trim()] = topic)
  //   item.topics = map
  // })

  data.objectKeys = ["north", "east", "west", "south", "northeast", "northwest", "southeast", "southwest", "up", "down", "topics", "items", "objects", "exits", "locations"]
  data.items.forEach(item => {
    item.aliases = item.aliases || []
    item.aliases = item.aliases.map(alias => alias.toLowerCase().trim())
    item.aliases.push(item.name.toLowerCase().trim())
    var topics = []
    _(item.topics).each(top => {
      top.aliases = top.aliases || []
      top.aliases = top.aliases.map(alias => alias.toLowerCase().trim())
      top.aliases.push(top.name.toLowerCase().trim())
      topics = topics.concat(top.aliases)
    })
    data.objectKeys = data.objectKeys.concat(item.aliases)
    data.objectKeys = data.objectKeys.concat(topics)
  })
  //add scene names to object list for fast travel
  data.parts.forEach( part => {
    if (part.sceneList){
      part.sceneList.forEach(scene => {
          data.objectKeys.push(scene.name)
      })
    }
  })

  data.objectKeys = _.uniq(data.objectKeys.map(item => item.toLowerCase()))
  data.fastTravel = []

  //Allow current part and scene to be defined in the gameSpec.
  data.currentPart = data.currentPart ? data.parts[data.currentPart] : data.parts[0]
  if(data.currentScene){
      data.currentScene = _.find(data.currentPart.sceneList, s => s.name.toLowerCase() === data.currentScene.toLowerCase())
  }
  return data
}

module.exports = {
  GameEngineFromYaml,
  GameEngineFromSpec
}

function GameEngineFromYaml(yaml, ...callbacks) {
  var gameState = jsYaml.load(yaml)
  return GameEngine(gameState, ...callbacks)
}

function GameEngineFromSpec(gameSpec, ...callbacks) {
  var gameState = GameState(JSON.parse(JSON.stringify(gameSpec)))
  return GameEngine(gameState, ...callbacks)
}

function GameEngine(gameState, updateText, updateAudio, updateCommand, save) {
  gameState.currentPart = gameState.currentPart || gameState.parts[0]
  var partIntro = gameState.currentPart.intro || []
  var outputQueue = partIntro.slice()
  if (!gameState.currentScene){
    if(gameState.currentPart.sceneList){
       gameState.currentScene = findScene(gameState.currentPart.openingScene || gameState.currentPart.sceneList[0].name)
    }else{
      gameState.currentScene= {exits: []}
    }
  }
  var directions = ["north", "east", "west", "south", "northeast", "northwest", "southeast", "southwest", "up", "down"]

  playCurrentScene(outputQueue)

  // playNextAudio()
  // gameState.currentScene.visited = true
  // TODO: extract playAudio and playNextAudio into a separate
  // object. right now this is hard to do because the GameEngine
  // is receiving the playback finished events.
  function playNextAudio() {
    if(outputQueue.length === 0){
      updateAudio("", true)
      return
    }
    var output = outputQueue.shift()
    if (output) {
      if(output.scriptor){
        safeEval(output.scriptor)
      }else{
        updateText(output.text)
        updateAudio(output.audio)
      }
    }

  }

  function playAudio(output){
    outputQueue = output.slice()
    playNextAudio()
  }

  function playAudioRunScript(output, scriptor){
    outputQueue = output.slice()
    outputQueue.push({scriptor})
    playNextAudio()
  }

  function parseCommand(command){
    command = " " + command.toLowerCase() + " "
    for (var i = 0; i < gameState.commandList.length ;i++){
      var keyword = gameState.commandList[i]
      var index = command.indexOf(" " + keyword + " ")
      if (index !== -1){
        return {command: keyword, remainder: command.substring(index + 1 + keyword.length)}
      }
    }
    return {command: null, remainder: command}
  }

  function getItemByName(name) {
    return _.find(gameState.items, item => item.name === name)
  }

  function findObjectByName(name){
    var scenes = []
    gameState.parts.forEach(part =>{
      scenes = scenes.concat(part.sceneList)
    })
    return _.find(scenes.concat(gameState.items), object => object.name.toLowerCase() === name.toLowerCase())
  }


  // Needed for objects that have aliases that are substrings of other aliases.
  // It always prefers the most specific name
  function preferLongNames(list){
    var remove = []
    for(var i = 0; i < list.length; i ++){
      for(var j = 0; j < list.length; j ++){
        var item = " " + list[i] + " "
        var index = item.indexOf(" " + list[j] + " ")
        if (index !== -1 && i != j){
          remove.push(list[j])
        }
      }
    }
    return _.without(list, ...remove)
  }

  function parseObjects(objects){
    objects = " " + objects.toLowerCase() + " "
    var objectList = []
    for (var i = 0; i < gameState.objectKeys.length; i++){
      var keyword = gameState.objectKeys[i]
      if (keyword == "") continue
      var index = objects.indexOf(" " + keyword + " ")
      if (index !== -1){
        objectList.push({name: gameState.objectKeys[i], index: index})
      }
    }
    objectList = _.sortBy(objectList, object => object.index)
    objectList = objectList.map(obj => obj.name)
    objectList = preferLongNames(objectList)
    return objectList
  }

  function playSceneDescription(){
    var output = []
    var items = gameState.currentScene.items || []
    var itemObjects = items.map(name => getItemByName(name))
    itemObjects = _.filter(itemObjects, obj => obj !== undefined && obj !== null)
    for (var i = 0; i< itemObjects.length; i++){
      output.push(itemObjects[i].inSceneDescription)
    }
    if (output.length === 0) {
      playAudio(gameState.defaultResponses["nothing in scene"])
    } else {
      playAudio(output)
    }
  }

  function getSceneDescription(){
    var output = []
    var items = gameState.currentScene.items || []
    var itemObjects = items.map(name => getItemByName(name))
    itemObjects = _.filter(itemObjects, obj => obj !== undefined && obj !== null)
    for (var i = 0; i< itemObjects.length; i++){
      output.push(itemObjects[i].inSceneDescription)
    }
    if (output.length === 0) {
      return gameState.defaultResponses["nothing in scene"]
    } else {
      return output
    }
  }

  function playItemDescription(item) {
    if(!item){
      playAudio(gameState.defaultResponses["no object"])
    }else{
      if(item.cycle){
        playCycle(item.description)
      }else{
        playInSequence(item.description)
      }
    }
  }

  function playInventory() {
    if(gameState.inventory.length > 0){
      playAudio(gameState.inventory.map(itemName =>
        getItemByName(itemName).inventory
      ))
    }else{
      playAudio(gameState.defaultResponses["empty inventory"])
    }

  }

  function findScene(sceneName){
    return _.find(gameState.currentPart.sceneList, s => s.name.toLowerCase() === sceneName.toLowerCase())
  }

  function getAvailableItems(){
    return gameState.inventory.concat(gameState.currentScene.items || [])
  }

  function playAvailableItems(){
    var avail = getAvailableItems()
    if (avail.length > 0){
      playAudio(avail.map(itemName =>
        getItemByName(itemName).inventory
      ))
    }else{
      playAudio(gameState.defaultResponses["nothing in scene"])
    }
  }


  function listTopics(obj){
    var topics = obj.topics
    if (topics.length > 0){
      var broachable = []
      var listTop = _.sample(gameState.defaultResponses["list topics"]) || {text: '\n\nYou could ask about ... ', audio: ""}
      broachable.push(listTop)
       _.each(topics, top => { if(top.broachable) {broachable.push(top.list);}})
      if (broachable.length > 1){
        playAudio(broachable)
      }else{
        playAudio(gameState.defaultResponses["nothing to talk about"])
      }
    }else{
      playAudio(gameState.defaultResponses["can't talk to"])
    }
  }

  function listExits(){
    var exits = gameState.currentScene.exits
    if (exits.length > 0){
      if (exits.length === 1){
          var output = gameState.defaultResponses["exit"]
          var to_add =  exits[0].text ? {text: exits[0].text, audio: exits[0].audio} : gameState.defaultResponses[exits[0].direction][0]
          output.push(to_add)
          playAudio(output)
      }else{
        var output = gameState.defaultResponses["exits"]
        var to_play = exits.slice(0, exits.length -1 ).map(e => {
          if(e.text){
            return {text: e.text + ", ", audio: e.audio}
          }
          return {text: gameState.defaultResponses[e.direction][0].text + ", ", audio: gameState.defaultResponses[e.direction][0].audio}
         })
        to_play.push(gameState.defaultResponses["and"][0])
        var to_add = exits[exits.length -1].text ?  {text: exits[exits.length -1].text, audio:  exits[exits.length -1].audio} : {text: gameState.defaultResponses[exits[exits.length -1].direction][0].text, audio: gameState.defaultResponses[exits[exits.length -1 ].direction][0].audio}
        to_play.push(to_add)
        output = output.concat(to_play)
        playAudio(output)
      }
    }else{
      playRandom(gameState.defaultResponses["no exit"])
    }
  }

  function findDirection(arr, dir){
    return _.find(arr, item => item.direction === dir)
  }

  function playCurrentScene(output = []){
    if(!gameState.currentScene.visited){
      if(gameState.currentScene.intro){
        output = output.concat(gameState.currentScene.intro)
      }
      gameState.currentScene.visited = true
      if (gameState.currentScene) gameState.fastTravel.push(gameState.currentScene)
      output = output.concat(getSceneDescription())
    }else{
      output.push({text: gameState.currentScene.name, audio: gameState.currentScene.nameAudio})
    }
    if(gameState.currentScene.script){
      playAudioRunScript(output, gameState.currentScene)
    }else{
      playAudio(output)
    }
  }

  function changeCurrentScene(direction){
    var nextScene
    if (directions.includes(direction)){
      if (gameState.converseWith){
        gameState.converseWith = null
      }
      nextScene = findDirection(gameState.currentScene.exits, direction)
      if (nextScene){
        gameState.lastDirection = direction
        if (nextScene.scene){
          gameState.currentScene = findScene(nextScene.scene)
          playCurrentScene()
        }else{
          if(nextScene.text){
            playAudio([{text: nextScene.text, audio: nextScene.audio}])
          }else{
            playAudio(gameState.defaultResponses.go)
          }
        }
      }else{
        playAudio(gameState.defaultResponses.go)
      }
    }else if(nextScene = findScene(direction)){
      if(gameState.fastTravel.includes(nextScene)){
        gameState.currentScene = nextScene
        playCurrentScene()
      }else{
        if(nextScene.visited){
          playAudio(gameState.defaultResponses["scene inaccessible"])
        }else{
          playAudio(gameState.defaultResponses.go)
        }
      }
    }else{
      playAudio(gameState.defaultResponses.go)
    }
  }

  function findActionByName(actions, name){
    return _(actions).find((action) => action.name === name)
  }

  function hasScript(object, keyword){
    return object && object.actions && findActionByName(object.actions, keyword) && findActionByName(object.actions, keyword).script
  }

  function findCombination(verb, firstObject, secondObject){
    return _.find(gameState.combinations, (comb) => {
      var grammar = comb.aliasGrammars[verb]
      return (grammar === 'either'
        && comb.objects.includes(firstObject.name)
        && comb.objects.includes(secondObject.name))
        || (grammar === 'reverse'
          && comb.objects[0] === secondObject.name
          && comb.objects[1] === firstObject.name)
        || (grammar !== 'reverse' && grammar !== 'either'
          && comb.objects[1] === secondObject.name
          && comb.objects[0] === firstObject.name)
    })
  }

  function combine(verb, firstObject, secondObject){
    var comb = findCombination(verb, firstObject, secondObject)
    if (comb){
      safeEval(comb)
      return true
    }
    return false
  }

  function combineAlias(keyword){
    return gameState.combineAliases.includes(keyword)
  }

  function findCommand(keyword, objectAliases){
    var firstObject = getLocalItemByAlias(objectAliases[0])
    var available = getAvailableItems()
    var secondObject = getLocalItemByAlias(objectAliases[1]) //|| {name: ''}
    if(firstObject && available.includes(firstObject.name)){
      if (secondObject && available.includes(secondObject.name)){
        if(combineAlias(keyword)){
          var executed = combine(keyword, firstObject, secondObject)
          if(!executed){
            playAudio(gameState.defaultResponses.generic)
          } return null
        }
      }
      if (firstObject.actions) {
        var cmd = _(firstObject.actions).find((action) => {
          var aliases = action.aliases
          return _(aliases).contains(keyword)
        })
        keyword = cmd ? cmd.name : keyword
      }
    }
    return keyword
  }

  function give(firstObject, secondName){
    var actions = _.where(firstObject.actions, {name: 'give', recipient: secondName})
    if(actions.length === 0){
      return null
    }else{
      return actions[0]
    }
  }

  function getLocalItemByAlias(alias) {
    var items = getAvailableItems()
    items = items.map(i => getItemByName(i))
    return _.find(items, item => {
      return _.contains(item.aliases, alias)
    })
  }

  function listFastTravel(){
    var output = gameState.fastTravel.map(scene => { return {text: scene.name, audio: scene.nameAudio}})
    playAudio(output)
  }

  function findTopicByAlias(obj, alias){
    return _.find(obj.topics, top => {
      return _.contains(top.aliases, alias)
    })
  }


  var standardCommandAliases = {'exit': 'go', 'pick up': 'take', 'look around': 'look'}
//Comands to be accounted for: [ "use", "open", "close",, "help", "push",
// "pull",  "save", "load"?, "give"]
  function executeCommand(keyword, objectAliases){
    switch (keyword) {
      case "list":
        switch (objectAliases[0]){
          case "objects":
          case "items":
            playAvailableItems()
            return
          case "inventory":
            playInventory()
            return
          case "exits":
            listExits()
            return
          case "topics":
            var firstObject = getLocalItemByAlias(objectAliases[1]) || gameState.converseWith
            if (firstObject){
              listTopics(firstObject)
            }else{
              playRandom(gameState.defaultResponses["no object"])
            }
            return
          case "locations":
            listFastTravel()
            return
        }
        return
      case "inventory":
        playInventory()
        return
      case "help":
        playAudio(gameState.defaultResponses.help ||
          [{text: "The commands are look, look at, take, use, open, close, push, pull, give, go, ask, talk to/goodbye, and list\n\n There are also natural language commands such as 'play piano'"}])
        return
      case "save":
        var yaml = jsYaml.dump(gameState)
        save(yaml)
        return
      case "climb":
        changeCurrentScene("up")
        return
      case "decend":
        changeCurrentScene("down")
        return
      case "exit":
      case "go":
        if (objectAliases.length > 0){
          changeCurrentScene(objectAliases[0])
        }else{
          playRandom(gameState.defaultResponses.go)
        }
        return
      case "look around":
      case "look":
        playSceneDescription()
        return
      case "end conversation":
      case "goodbye":
      case "leave":
        if (gameState.converseWith){
          var action = findActionByName(gameState.converseWith.actions, "talk to" )
          var farewell = action? action.goodbye : []
          gameState.converseWith = null
          playInSequence(farewell)
        }
        return

    }

    if (keyword === "use" && objectAliases.length > 1){
      //TODO: FIX: when objectAliases > 2 because of name overlap, e.g. light switch and light, and use is used, shouldn't be interpreted as combine
      keyword = "combine"
    }
    var keyword = findCommand(keyword, objectAliases)
    if (!keyword) return false
    var firstObject = getLocalItemByAlias(objectAliases[0])
    var available = getAvailableItems()

    if (!firstObject || !available.includes(firstObject.name)){
      firstObject = null
    }

    // if (standardCommandAliases[keyword]){
    //   keyword = standardCommandAliases[keyword]
    // }
    //

    if(gameState.converseWith){
      if (keyword === "ask"){
        objectAliases.splice(1, 0, objectAliases[0])
        firstObject = gameState.converseWith
      }
    }

    if (firstObject){
      switch(keyword){
                // case "combine": //since use is an alias for combine, it can accidentally think the command was combine when there's only on arg.
        case "use":
          if (hasScript(firstObject, "use")){
            safeEval(findActionByName(firstObject.actions, "use"))
          }else{
            playRandom(gameState.defaultResponses["use"])
          }
          break
        case "pick up":
        case "get":
        case "take":
          if (hasScript(firstObject, "take")){
            safeEval(findActionByName(firstObject.actions, "take"))
          }else{
            if(firstObject.takeable){
              takeObject(firstObject)
            }else{
              playRandom(gameState.defaultResponses["take failure"])
            }
          }
          break
        case "examine":
        case "inspect":
        case "look at":
          if (hasScript(firstObject, "look at")){
            safeEval(findActionByName(firstObject.actions, "look at" ))
          }else{
            playItemDescription(firstObject)
          }
          break
        case "talk to":
          var action = findActionByName(firstObject.actions, "talk to" )
          if (action || (firstObject.topics && firstObject.topics.length > 0)){
            if (hasScript(firstObject, "talk to")){
              safeEval(findActionByName(firstObject.actions, "talk to" ))
            }
            gameState.converseWith = firstObject
            var greeting = action ? action.greeting : null
            if(greeting) playInSequence(greeting)
            listTopics(firstObject)
          }else{
            playRandom(gameState.defaultResponses.ask)
          }
          break
        case "ask":
          if (firstObject && firstObject.topics) {
            var topic = findTopicByAlias(firstObject, objectAliases[1])
            if (topic && topic.broachable ){
              if (topic.script){
                safeEval(topic)
              }else{
                playInSequence(topic.response)
              }
            }else{
              playRandom(gameState.defaultResponses.ask)
            }
          }else{
            playRandom(gameState.defaultResponses.ask)
          }
          break
        case "give":
          var secondObject = getLocalItemByAlias(objectAliases[1])
          if (secondObject && available.includes(secondObject.name)){
            var scriptor = give(secondObject, firstObject.name)
            if (scriptor && scriptor.script) {
              safeEval(scriptor)
            }else{
              scriptor = give(firstObject, secondObject.name)
              if (scriptor && scriptor.script) {
                safeEval(scriptor)
              }else{
              playRandom(gameState.defaultResponses.give)
              }
            }
          }
          break
        case "push":
          if (hasScript(firstObject, "push")){
            safeEval(findActionByName(firstObject.actions, keyword ))
          }else{
            playRandom(gameState.defaultResponses.push)
          }
          break
        case "pull":
          if (hasScript(firstObject, "pull")){
            safeEval(findActionByName(firstObject.actions, keyword ))
          }else{
            playRandom(gameState.defaultResponses.pull)
          }
          break
        case "open":
          if (hasScript(firstObject, "open")){
            safeEval(findActionByName(firstObject.actions, keyword ))
          }else{
            if(firstObject.openable){
              if(firstObject.isOpen){
                playRandom(gameState.defaultResponses["already open"])
              }else if(firstObject.isLocked){
                playRandom(gameState.defaultResponses["open fail locked"])
              }else{
                firstObject.isOpen = true
                playRandom(gameState.defaultResponses["open success"])
              }
            }else{
              playRandom(gameState.defaultResponses["open fail"])
            }
          }
          break
        case "close":
          if (hasScript(firstObject, "close")){
            safeEval(findActionByName(firstObject.actions, keyword ))
          }else{
            if(firstObject.openable){
              if(!firstObject.isOpen){
                playRandom(gameState.defaultResponses["already closed"])
              }else{
                firstObject.isOpen = false
                playRandom(gameState.defaultResponses["close success"])
              }
            }else{
              playRandom(gameState.defaultResponses["close fail"])
            }
          }
          break
        default:
          console.log("Command result not defined: " + keyword)
          playRandom(gameState.defaultResponses["no object"])
          break
      }
    }else{
      playRandom(gameState.defaultResponses["no object"])
    }
  }

  function safeEval(scriptor, argMap){
    try{
      argMap = argMap || {}
      gameState.scriptor = scriptor
      var api = apiGen(gameState, outputQueue, updateCommand, updateText, updateAudio, playAudio, playNextAudio, findScene, getAvailableItems, playCurrentScene, findObjectByName, listTopics)
      var argMap = Object.assign(argMap, api)
      var keys = Object.keys(argMap)
      var values = Object.values(argMap)
      var f = new Function(...keys, scriptor.script)
      f(...values)
    }catch(err){
      playAudio([{text: err.toString(), audio: ""}])
    }
  }

  function submitCommand(command) {
    var output = command
    var commandObject = parseCommand(command)
    var key = commandObject.command
    if (key){
      var objects = parseObjects(commandObject.remainder)
      updateCommand(key + commandObject.remainder)
      executeCommand(key, objects)
    }else{
      playAudio([{text: "", audio: ""}])
    }
  }

  function takeObject(item) {
    if (!item) {
      playRandom(gameState.defaultResponses["no object"])
    }else if (gameState.inventory.includes(item.name)) {
      playRandom(gameState.defaultResponses["already have"])
    }else{
      playRandom(gameState.defaultResponses["take success"])
      gameState.currentScene.items = _.without(gameState.currentScene.items, item.name)
      gameState.inventory.push(item.name)
    }
  }

  function getAllKeywords(){
    return gameState.commandList.concat(gameState.objectKeys)
  }


  function playRandom(array){
    playAudio([_.sample(array)])
  }

  function playInSequence(array){
    if (array.length > 1){
      playAudio([array.shift()])
    }else{
      playAudio(array)
    }
  }

  function playCycle(array){
    if (array.length > 1){
      var to_play = array.shift()
      playAudio([to_play])
      array.push(to_play)
    }else{
      playAudio(array)
    }
  }

  function setCurrentPartAndScene(index, sceneName){
    gameState.currentPart = gameState.parts[index]
    gameState.currentScene = findScene(sceneName) || findScene(gameState.currentPart.openingScene || gameState.currentPart.sceneList[0].name)
    var partIntro = gameState.currentPart.intro || []
    var outputQueue = partIntro.slice()
    playCurrentScene(outputQueue)
  }

  return {
    audioFinished: playNextAudio,
    parseCommand,
    submitCommand,
    parseObjects,
    getLocalItemByAlias,
    getAllKeywords,
    setCurrentPartAndScene
  }
}
