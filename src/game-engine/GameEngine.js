var _ = require('underscore')
var apiGen = require('./api')
var jsYaml = require("js-yaml")

function clone(obj){
  return JSON.parse(JSON.stringify(obj))
}

function GameState(data) {
  data.timers = data.timers || {}

//at the moment, commands that are are a substring of other commands should be placed after the longer command. ie. "Look around" and "look at" before "look"
  data.commandList = [ "give", "ask", "combine", "look at exits", "look at the exits", "look at", "look under", "look around", "examine room", "explore room", "explore", "use", "pick up",
  "take",  "open", "close", "push", "pull", "talk to", "end conversation", "leave", "goodbye",
  "inventory", "help", "save", "load", "go", "exit", 'list', "examine", "inspect", "get", "grab", "who", "what", "when", "where can i go", "where have i been", "where", "why", "how", "look", "climb down", "climb", "descend", "fast travel", "touch", "smell", "taste", "listen", "feel"]
  data.items = data.items || []
  var actionAliases = []
  data.items.forEach(item => {
    item.actions = item.actions || []
    item.flags = {}
    _(item.actions).each((action) => {
      action.aliases = action.aliases || []
      action.aliases = action.aliases.map(a => a.trim())
      action.aliases.push(action.name.toLowerCase().trim())
      actionAliases = actionAliases.concat(action.aliases)
    })
  })
  data.commandList = data.commandList.concat(actionAliases)

  _(data.combinations).each(comb => {
    var map = {}
    _.each(comb.aliasGrammars, item => map[item.name.toLowerCase().trim()] = item.order)
    comb.aliasGrammars = map
    comb.objects = comb.objects.map(obj => obj.toLowerCase().trim())
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
  _(data.items).each(item => mapping[item.id] = item.name.toLowerCase())
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
  data.itemNames = ["north", "east", "west", "south", "northeast", "northwest", "southeast", "southwest", "up", "down", "topics", "items", "objects", "exits", "locations", "inventory", "rooms", "fast travel"]
  data.objectKeys = ["north", "east", "west", "south", "northeast", "northwest", "southeast", "southwest", "up", "down", "topics", "items", "objects", "exits", "locations", "inventory", "rooms", "fast travel"]
  data.items.forEach(item => {
    item.aliases = item.aliases || []
    item.aliases = item.aliases.map(alias => alias.toLowerCase().trim())
    item.aliases.push(item.name.toLowerCase().trim())
    data.itemNames.push(item.name.toLowerCase().trim())
    item.name = item.name.toLowerCase()
    var topics = []
    _(item.topics).each(top => {
      top.aliases = top.aliases || []
      top.aliases = top.aliases.map(alias => alias.toLowerCase().trim())
      top.aliases.push(top.name.toLowerCase().trim())
      data.itemNames.push(top.name.toLowerCase().trim())
      topics = topics.concat(top.aliases)
    })
    data.objectKeys = data.objectKeys.concat(item.aliases)
    data.objectKeys = data.objectKeys.concat(topics)

  })
  //add scene names to object list for fast travel
  data.parts.forEach( part => {
    if (part.sceneList){
      part.sceneList.forEach(scene => {
          scene.aliases = scene.aliases || []
          scene.aliases = scene.aliases.map(alias => alias.toLowerCase().trim())
          var nameAlias = scene.name.toLowerCase().trim().replace(/^(the\ )/,"").replace(/^(a\ )/,"");
          // data.itemNames.push(nameAlias)
          scene.aliases.push(nameAlias)
          data.objectKeys = data.objectKeys.concat(scene.aliases)
      })
    }
  })

  data.objectKeys = _.uniq(data.objectKeys.map(item => item.toLowerCase().trim()))

  data.fastTravel = []

  //Allow current part and scene to be defined in the gameSpec.
  data.currentPart = data.currentPart ? data.parts[data.currentPart] : data.parts[0]
  if(data.currentScene){
      data.currentScene = _.find(data.currentPart.sceneList, s => s.name.toLowerCase() === data.currentScene.toLowerCase())
  }

  data.commandList = Array.from(new Set(data.commandList))
  data.itemNames = Array.from(new Set(data.itemNames))
  return data
}

module.exports = {
  GameEngineFromYaml,
  GameEngineFromSpec
}

function GameEngineFromYaml(yaml, ...callbacks) {
  var gameState = jsYaml.load(yaml)
  return GameEngine(gameState, ...callbacks, true)
}

function GameEngineFromSpec(gameSpec, ...callbacks) {
  var gameState = GameState(JSON.parse(JSON.stringify(gameSpec)))
  return GameEngine(gameState, ...callbacks)
}

function GameEngine(gameState, updateText, updateAudio, updateCommand, save, fromSave) {
  var timers = {}
  var self = {
    audioFinished: playNextAudio,
    parseCommand,
    submitCommand,
    parseObjects,
    getLocalItemByAlias,
    getAllKeywords,
    setCurrentPartAndScene,
    getYaml,
    start
  }

  gameState.currentPart = gameState.currentPart || gameState.parts[0]

  var tempAPI = apiGen(gameState, timers, outputQueue, updateCommand, updateText, updateAudio, playAudio, playNextAudio, findScene, getAvailableItems, playCurrentScene, findObjectByName, listTopics, listExits, timers.startTimer, timers.stopTimer)
  tempAPI.restartTimers()

  // window.globalFunctions = Object.assign({}, tempAPI)
  // for(var key in tempAPI){
  //   this[key] = tempAPI[key]
  // }

  var outputQueue;

  function start(){
    var partIntro = gameState.currentPart.intro || []
    outputQueue = partIntro.slice()
    if (!gameState.currentScene){
      if(gameState.currentPart.sceneList){
         gameState.currentScene = findScene(gameState.currentPart.openingScene || gameState.currentPart.sceneList[0].name)
      }else{
        gameState.currentScene= {exits: []}
      }
    }
    playCurrentScene(outputQueue)
  }

  var directions = ["north", "east", "west", "south", "northeast", "northwest", "southeast", "southwest", "up", "down"]


  // playNextAudio()
  // gameState.currentScene.visited = true
  // TODO: extract playAudio and playNextAudio into a separate
  // object. right now this is hard to do because the GameEngine
  // is receiving the playback finished events.
  function playNextAudio(append, other) {
    console.log("playNextAudio", outputQueue.length, JSON.stringify(outputQueue))
    if(outputQueue.length === 0){
      updateText({text: ""}, true, false, self)
      // updateAudio("", true, self)
      return
    }
    var output = outputQueue.shift()
    if (output) {
      console.log("output is truthy", output)
      if(output.scriptor){
        safeEval(output.scriptor)
        if(outputQueue.length === 0){
          updateText({text: ""}, true, false, self)
          // updateAudio("", true, self)
        }
      }else{
        console.log("output is text", append)
        var wait = updateText(output, false, append, self)
        if(wait){
          console.log("unshifting")
          //Something from scripts is playing and output is supposed to append so wait to play next thing
          outputQueue.unshift(output)
        }
        // updateAudio(output.audio, false, self)
      }
    }
    console.log(output)

  }

  function playAudio(output){
    // outputQueue = output.slice()
    // playNextAudio(false)
    if(outputQueue.length === 0){
      outputQueue = output.slice()
      playNextAudio(false)
    }else{
      outputQueue = outputQueue.concat(output.slice())
      playNextAudio(true)
    }
  }

  // function addToQueueOrPlay(output){
  //   if(outputQueue.length === 0){
  //     playNextAudio(false)
  //   }else{
  //     outputQueue = output.slice()
  //     playNextAudio(true)
  //   }
  // }

  function appendAudio(output){
    console.log("appendAudio", outputQueue, output)
    outputQueue = outputQueue.concat(output.slice())
    console.log(outputQueue)
    playNextAudio(true)
  }

  function playOrAppendAudio(output, append){
    if(append){
      appendAudio(output)
    }else{
      playAudio(output)
    }
  }

  function appendAudioRunScript(output, scriptor){
    outputQueue = outputQueue.concat(output.slice())
    console.log("appendAudioRunScript", JSON.stringify(output))
    safeEval(scriptor)
    playNextAudio(true)
  }


  function playAudioRunScript(output, scriptor){
    // outputQueue = output.slice()
    // console.log("playAudioRunScript", JSON.stringify(outputQueue))
    playAudio(output)
    safeEval(scriptor)
    // playNextAudio(false)
  }

  function parseCommand(command){
    command = " " + command.toLowerCase() + " "
    var list =  []
    for (var i = 0; i < gameState.commandList.length ;i++){
      var keyword = gameState.commandList[i]
      var index = command.indexOf(" " + keyword + " ")
      if (index !== -1){
        list.push({command: keyword, remainder: command.substring(index + 1 + keyword.length), index})
      }
    }
    if(list.length > 0){
      list = _(list).sortBy('index')
      return list.reduce(function (a, b) { return b.command.includes(a.command) ? b : a; });
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
        if (index !== -1 && i !== j){
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
      if (keyword === "") continue
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
      output.push(_.sample(gameState.defaultResponses["nothing in scene"]))
    }
    if(gameState.currentScene.listExits) {output = output.concat(getExits())}
    playAudio(output)
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
      var output = []
      if(gameState.defaultResponses.inventory && gameState.defaultResponses.inventory[0]) output.push(gameState.defaultResponses.inventory[0])
      var items = gameState.inventory.map( name => getItemByName(name))
      items  = _.filter(items, i => i.inventory.text)
      for ( var i = 0; i < items.length; i++){
        output.push({text: "• " , audio: ""})
        output.push(items[i].inventory)
        output.push({text: "\n" , audio: ""})
      }
      // var item = _.last(items)
      // output.push({text: item.inventory.text, audio: item.inventory.audio})
      // output.push({text: "." , audio: ""})
      playAudio(output)
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


  function formatTopic(topic){
    let cl = clone(topic)
    cl.text  += "\n"
    return cl
  }

  function listTopics(obj, append){
    var topics = obj.topics
    if (topics.length > 0){
      var broachable = []
      var listTop = null
      var action = findActionByName(obj.actions, "talk to" )
      if(action && action.listTopics && action.listTopics.length > 0){
        listTop = _.sample(action.listTopics)
      }else{
        listTop =  _.sample(gameState.defaultResponses["list topics"]) || {text: '\n\nYou could ask about ...\n\n', audio: ""}
      }
      broachable.push(listTop)
       _.each(topics, top => { if(top.broachable) {broachable.push(formatTopic(top.list));}})
      if (broachable.length > 1){
        playOrAppendAudio(broachable, append)
      }else{
        playOrAppendAudio(gameState.defaultResponses["nothing to talk about"], append)
      }
    }else{
      playOrAppendAudio(gameState.defaultResponses["can't talk to"], append)
    }
  }

  function filterExits(exits){
    return _.reject(exits, e => !e.scene)
  }

  function getExits(){
    var exits = filterExits(gameState.currentScene.exits)
    if (exits.length > 0){
      if (exits.length === 1){
          var output = gameState.defaultResponses["exit"].slice()
          var to_add =  exits[0].text ? {text: exits[0].text, audio: exits[0].audio} : { text: gameState.defaultResponses[exits[0].direction][0].text , audio: gameState.defaultResponses[exits[0].direction][0].audio}
          output.push(to_add)
          output.push({text: "."})
          return output
      }else{
        var output = gameState.defaultResponses["exits"].slice()
        var to_play = []
        for (var e of exits.slice(0, exits.length -1 )){
          if(e.text){
            to_play.push({text: e.text + ","})
          }else{
            to_play.push({text: gameState.defaultResponses[e.direction][0].text + ",", audio: gameState.defaultResponses[e.direction][0].audio})
          }
        }
        to_play.push(gameState.defaultResponses["and"][0])
        var to_add = exits[exits.length -1].text ?  {text: exits[exits.length -1].text, audio:  exits[exits.length -1].audio} : {text: gameState.defaultResponses[exits[exits.length -1].direction][0].text, audio: gameState.defaultResponses[exits[exits.length -1 ].direction][0].audio}
        to_play.push(to_add)
        to_play.push({text: "."})
        output = output.concat(to_play)
        return output
      }
    }else{
      return [_.sample(gameState.defaultResponses["no exit"])]
    }
  }

  function listExits(){
    playAudio(getExits())
  }

  function findDirection(arr, dir){
    return _.find(arr, item => item.direction === dir)
  }

  function playCurrentScene(output = [], api){
    console.log("playCurrentScene")
    if (gameState.converseWith){
      gameState.converseWith = null
    }
    console.log("play current scene")

    if(!gameState.currentScene.visited){
      if(gameState.currentScene.intro){
        output = output.concat(gameState.currentScene.intro)
      }
      gameState.currentScene.visited = true
      if (gameState.currentScene) gameState.fastTravel.push(gameState.currentScene)
      output = output.concat(getSceneDescription())
      if(gameState.currentScene.listExits) {output = output.concat(getExits())}
    }else{
      var text = gameState.currentScene.name
      if (api) output.push({text: "\n\n"})
      output.push({text, audio: gameState.currentScene.nameAudio})
      output.push({text: "\n"})
      console.log("play scene name")

    }
    console.log(output)
    if(gameState.currentScene.script){
      if(api){
        appendAudioRunScript(output, gameState.currentScene)
      }else{
        playAudioRunScript(output, gameState.currentScene)
      }
    }else{
      if(api){
        appendAudio(output)
      }else{
        playAudio(output)
      }
    }
  }

  function findAliasedScene(alias){
    return _.find(gameState.currentPart.sceneList, s => s.aliases.includes(alias.toLowerCase()))

  }

  function findFastTravelSceneByAlias(alias){
    return _.find(gameState.fastTravel, s => s.aliases.includes(alias.toLowerCase()))

  }

  function connectedToCurrentScene(exits, scene){
    for (var e of exits){
      if(e.scene === scene.name) return true
    }
  }


  function changeCurrentScene(direction, keyword){
    var nextScene
    console.log("change current scene")
    if (directions.includes(direction)){
      nextScene = findDirection(gameState.currentScene.exits, direction)
      if (nextScene){
        gameState.lastDirection = direction
        if (nextScene.scene){
          console.log("nextScene", nextScene)

          if(gameState.currentScene.leaving_script){
            console.log("gameState.currentScene.leaving_script", gameState.currentScene.leaving_script)
            safeEval(gameState.currentScene, {}, "leaving_script")
          }
          gameState.currentScene = findScene(nextScene.scene)
          if(nextScene.silent){
            if(gameState.currentScene.script) safeEval(gameState.currentScene)
          }else{
             playCurrentScene()
          }
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
    }else if(nextScene = findFastTravelSceneByAlias(direction)){
      if(gameState.currentScene.leaving_script) safeEval(currentScene, {}, "leaving_script")
      gameState.currentScene = nextScene
      playCurrentScene()
    }else if(nextScene = findAliasedScene(direction)){
      if(connectedToCurrentScene(gameState.currentScene.exits, nextScene)){
        if(gameState.currentScene.leaving_script) safeEval(currentScene, {}, "leaving_script")
        gameState.currentScene = nextScene
        playCurrentScene()
      }else if (nextScene.visited){
        playAudio(gameState.defaultResponses["scene inaccessible"])
      }else{
        playAudio(gameState.defaultResponses.go)
      }
    }else{
      var firstObject = getLocalItemByAlias(direction)
      if (firstObject){
        var action = findActionByAlias(firstObject.actions, keyword) //Does this ever change the scene?
      }
      if(action){
        if (action.script){
          safeEval(action)
        }else{
          if(action && action.failure){
            playRandom(action.failure)
          }else{
            playRandom(gameState.defaultResponses.go)
          }
        }
      }else{
        playAudio(gameState.defaultResponses.go)
      }
    }
  }

  function findActionByName(actions, name){
    return _(actions).find((action) => action.name === name)
  }

  function findActionByAlias(actions, alias){
    return _(actions).find((action) => _(action.aliases).contains(alias))
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
        || (grammar && grammar !== 'reverse' && grammar !== 'either'
          && comb.objects[1] === secondObject.name
          && comb.objects[0] === firstObject.name)
    })
  }

  function combine(verb, firstObject, secondObject){
    var comb = findCombination(verb, firstObject, secondObject)
    if (comb){
      if (comb.responses){
        playInSequence(comb.responses)
      }
      safeEval(comb)
      return true
    }
    return false
  }

  function combineAlias(keyword){
    return gameState.combineAliases.includes(keyword)
  }

  function isGiveAlias(keyword, firstObject, secondObject){
    var action = findActionByAlias(firstObject.actions, keyword)
    var action2 = findActionByAlias(secondObject.actions, keyword)

    return (action && action.name === "give") || (action2 && action2.name === "give")
  }

  function findCommand(keyword, objectAliases){
    var firstObject = getLocalItemByAlias(objectAliases[0])
    var available = getAvailableItems()
    var secondObject = getLocalItemByAlias(objectAliases[1]) //|| {name: ''}
    if(firstObject && available.includes(firstObject.name)){

      if (secondObject && available.includes(secondObject.name)){
        if(combineAlias(keyword)){
          console.log("combination, findCommand, objects exist")
          var executed = combine(keyword, firstObject, secondObject)
          if(!executed){
            if(isGiveAlias(keyword, firstObject, secondObject)){
              callGive(firstObject, secondObject, available)
              return null
            }
            if (firstObject.combinationFailure){
              playRandom(firstObject.combinationFailure)
            }else if(secondObject.combinationFailure){
              playRandom(secondObject.combinationFailure)
            }else{
              playAudio(gameState.defaultResponses.generic)
            }
          }
          return null
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

  function callGive(firstObject, secondObject, available){
    if (secondObject && available.includes(secondObject.name)){
      var scriptor = give(secondObject, firstObject.name)
      if (scriptor){
        if(scriptor.script){
          safeEval(scriptor)
        }else if(scriptor.failure){
          playRandom(scriptor.failure)
        }
      }else{
        var scriptor2 = give(firstObject, secondObject.name)
        if (scriptor2) {
          if(scriptor2.script){
            safeEval(scriptor2)
          }else if(scriptor2.failure){
            playRandom(scriptor2.failure)
          }
        }else{
          var defaultGive = give(secondObject, "other") || give(firstObject, "other")
          if(defaultGive && defaultGive.failure){
            playRandom(defaultGive.failure)
          }else{
            playRandom(gameState.defaultResponses.give)
          }
        }
      }
    }else{
      playRandom(gameState.defaultResponses.give)
    }
  }

  function give(firstObject, secondName){
    var actions = _.filter(firstObject.actions, (elem) => elem.name === 'give' && elem.recipient.toLowerCase() === secondName)
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
    var output = gameState.fastTravel.map(scene => { return {text: scene.name + "\n", audio: scene.nameAudio}})
    playAudio(output)
  }

  function findTopicByAlias(obj, alias){

    var broachable = _(obj.topics).where({broachable: true})
    return _.find(broachable, top => {
      return _.contains(top.aliases, alias)
    })
  }

  function leave(){
    if (gameState.currentScene.exits.length === 1){
      changeCurrentScene(gameState.currentScene.exits[0].direction)
    }else{
      listExits()
    }
  }

  function regularAction(firstObject, keyword){
    var action  = findActionByName(firstObject.actions, keyword)
    if (hasScript(firstObject, keyword)){
      safeEval(action)
    }else{
      if(action && action.failure){
        playRandom(action.failure)
      }else{
        playRandom(gameState.defaultResponses[keyword])
      }
    }
  }


  var standardCommandAliases = {'exit': 'go', 'pick up': 'take', 'look around': 'look'}
//Comands to be accounted for: [ "use", "open", "close",, "help", "push",
// "pull",  "save", "load"?, "give"]
  function executeCommand(keyword, objectAliases, raw_input, no_command){
    var k = keyword
    k = k.slice(0,3)
    if (k !== "go "){
      k =  keyword
    }else{
      k = "go"
    }
    console.log("Execute")
    console.log(keyword, objectAliases)
    switch (k) {
      case "list":
        switch (objectAliases[0]){
          // case "objects":
          case "items":
            playInventory()
            // playAvailableItems()
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
              playRandom(gameState.defaultResponses["not in conversation"])
            }
            return
          case "fast travel":
          case "rooms":
          case "locations":
            listFastTravel()
            return
          default:
            playAudio([{text: "Command not found", audio: ""}])
        }
        return
      case "where can i go":
      case "where have i been":
      case "fast travel":
        listFastTravel()
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
      case "look at exits":
      case "look at the exits":
        listExits()
        return
      // case "climb":
      //   changeCurrentScene("up")
      //   return
      // case "climb down":
      // case "decend":
      //   changeCurrentScene("down")
      //   return
      case "exit":
      case "go":
        console.log("go", k)
        if (objectAliases.length > 0){
          console.log("objectAliases.length > 0")
          changeCurrentScene(objectAliases[0], keyword)
        }else{
          playRandom(gameState.defaultResponses.go)
        }
        return
      case "leave":
        leave()
        return
      case "examine room":
      case "explore":
      case "explore room":
      case "look around":
      // case "look":
        playSceneDescription()
        return
      case "end conversation":
      case "goodbye":
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
    var questions = ["who", "what","when","where","why","how","ask"]
    if(gameState.converseWith){
      if (questions.includes(keyword) && objectAliases.length === 1){
        objectAliases.splice(1, 0, objectAliases[0])
        firstObject = gameState.converseWith
      }
    }

    console.log(!!firstObject, keyword, firstObject, !!gameState.converseWith, objectAliases )
    if (firstObject){
      switch(keyword){
                // case "combine": //since use is an alias for combine, it can accidentally think the command was combine when there's only on arg.
        case "use":
          regularAction(firstObject, keyword)
          break
        case "look under":
          regularAction(firstObject, keyword)
          break
        case "pick up":
        case "get":
        case "grab":
        case "take":
          var action = findActionByName(firstObject.actions, "take")
          if (hasScript(firstObject, "take")){
            safeEval(action)
          }else{
            if(firstObject.takeable){
              takeObject(firstObject)
            }else{
              if(action && action.failure){
                playRandom(action.failure)
              }else{
                playRandom(gameState.defaultResponses["take failure"])
              }
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
            listTopics(firstObject, true)
          }else{
            playRandom(gameState.defaultResponses["can't talk to"])
          }
          break
        case "who":
        case "what":
        case "when":
        case "where":
        case "why":
        case "how":
        case "ask":
          if(firstObject && !gameState.converseWith){
            playRandom(gameState.defaultResponses["not in conversation"])
          }else if (firstObject && firstObject.topics) {
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
          callGive(firstObject, secondObject, available)
          break
        case "push":
          regularAction(firstObject, keyword)
          break
        case "pull":
          regularAction(firstObject, keyword)
          break
        case "open":
          var action = findActionByName(firstObject.actions, keyword)

          if (hasScript(firstObject, "open")){
            safeEval(action)
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
              if(action && action.failure){
                playRandom(action.failure)
              }else{
                playRandom(gameState.defaultResponses["open fail"])
              }
            }
          }
          break
        case "close":
          var action = findActionByName(firstObject.actions, keyword)
          if (hasScript(firstObject, "close")){
            safeEval(action)
          }else{
            if(firstObject.openable){
              if(!firstObject.isOpen){
                playRandom(gameState.defaultResponses["already closed"])
              }else{
                firstObject.isOpen = false
                playRandom(gameState.defaultResponses["close success"])
              }
            }else{
              if(action && action.failure){
                playRandom(action.failure)
              }else{
                playRandom(gameState.defaultResponses["close fail"])
              }
            }
          }
          break
        default:
          var action  = findActionByName(firstObject.actions, keyword)
          if (action){
            if (hasScript(firstObject, keyword)){
              safeEval(action)
            }else{
              if(action && action.failure){
                playRandom(action.failure)
              }else{
                playRandom(gameState.defaultResponses["use"])
              }
            }
          }else{
            if(keyword === "combine"){
              playRandom(gameState.defaultResponses["no object"])
            }else{
              playRandom(gameState.defaultResponses.generic)
            }
          }
          break
      }
    }else{
      var objectAliases = parseObjects(raw_input)
      var firstObject = gameState.converseWith
      if (firstObject && firstObject.topics && objectAliases.length === 1) {
        var topic = findTopicByAlias(firstObject, objectAliases[0])
        if (topic && topic.broachable ){
          if (topic.script){
            safeEval(topic)
          }else{
            playInSequence(topic.response)
          }
        }else{
          if(no_command){
            playRandom(gameState.defaultResponses.ask)
          }else{
            playRandom(gameState.defaultResponses["no object"])
          }
        }
      }else if(gameState.converseWith && no_command){
        playRandom(gameState.defaultResponses.ask)
      }else{
        switch(keyword){
          case "who":
          case "what":
          case "when":
          case "where":
          case "why":
          case "how":
          case "ask":
            playRandom(gameState.defaultResponses["not in conversation"])
            return
          case "look":
            playSceneDescription()
            return
          case "sniff":
          case "smell":
            var room = getLocalItemByAlias("room")
            if(room){
              regularAction(room, "smell")
            }else{
              playRandom(gameState.defaultResponses["smell"])
            }
            return
          case "lick":
          case "taste":
            var room = getLocalItemByAlias("room")
            console.log("Getting the room", room)
            if(room){
              regularAction(room, "taste")
            }else{
              playRandom(gameState.defaultResponses["taste"])
            }
          return
          case "listen":
            var room = getLocalItemByAlias("room")
            if(room){
              regularAction(room, keyword)
            }else{
              playRandom(gameState.defaultResponses[keyword])
            }
            return
          case "touch":
          case "feel":
            var room = getLocalItemByAlias("room")
            if(room){
              regularAction(room, "touch")
            }else{
              playRandom(gameState.defaultResponses["touch"])
            }
            return
          case "climb":
            changeCurrentScene("up")
            return
          case "climb down":
            changeCurrentScene("down")
            return
        }
        playRandom(gameState.defaultResponses["no object"])
      }
    }
  }

  function safeEval(scriptor, argMap, scriptLabel){
    try{
      console.log("safeEval", scriptor, scriptLabel)
      argMap = argMap || {}
      gameState.scriptor = scriptor
      var api = apiGen(gameState, timers, outputQueue, submitCommand, updateCommand, updateText, updateAudio, appendAudio, playNextAudio, findScene, getAvailableItems, playCurrentScene, findObjectByName, listTopics, getExits, playInventory, findCombination, findTopicByAlias, scriptLabel)
      argMap = Object.assign(argMap, api)
      var keys = Object.keys(argMap)
      var values = Object.values(argMap)
      var f = new Function(...keys, scriptor[scriptLabel || "script"])
      f(...values)
    }catch(err){
      console.log("err", scriptor, argMap, scriptLabel)
      playAudio([{text: err.toString(), audio: ""}])
    }
  }


  function submitCommand(command, api) {
    outputQueue = []
    var output = command
    var command = command.toLowerCase()
    var commandObject = parseCommand(command)
    var key = commandObject.command
    if (key){
      var objects = parseObjects(commandObject.remainder)
      if(!api) setTimeout( () => updateCommand(output), 0)
      // if(!api) setTimeout( () => updateCommand(key + commandObject.remainder), 0)
      outputQueue = []
      // executeCommand(key, objects, command)
      setTimeout( () => executeCommand(key, objects, command), 0)
    }else{
      if(!api) setTimeout( () => updateCommand(output), 0)
      if(gameState.converseWith){
        var objects = parseObjects(commandObject.remainder)
        if(objects.length > 0){
          outputQueue = []
          // executeCommand("ask", objects)
          setTimeout( () => executeCommand("ask", objects,  output, true), 0)
          return
        }
      }else{
        setTimeout( () => playAudio([{text: "Command not found", audio: ""}]))
      }
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
    console.log(gameState.commandList, gameState.itemNames)
    return gameState.commandList.concat(gameState.itemNames).concat(["go north", "go south", "go east", "go west", "go southeast", "go southwest", "go northeast", "go northwest"])
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
    var output = partIntro.slice()
    playCurrentScene(outputQueue)
  }

  function getYaml(){
    return jsYaml.dump(gameState)
  }

  return self
}
