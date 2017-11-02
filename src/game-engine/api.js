var _ = require('underscore')

module.exports = function apiGen(gameState, timers, outputQueue, updateCommand, updateText, updateAudio, playAudio, playNextAudio, findScene, getAvailableItems, playCurrentScene, findObjectByName, listTopics, listExits, playInventory, findCombination, findTopicByAlias){

  function startTimer(name, seconds, func, ...args){
      gameState.timers = gameState.timers || {}
      gameState.timers[name] = {end: seconds, func, args};
      // console.log("func", gameState.timers[name].func)
      timers[name] = setInterval(function (name) {
        gameState.timers[name].end -= 1
        if(gameState.timers[name].end <= 0){
          gameState.timers[name].func(...gameState.timers[name].args)
          stopTimer(name)
        }
      }, 1000, name)
      // console.log(timers[name])
  }

  function stopTimer(name){
    // console.log("Stop timer")
    clearInterval(timers[name])
    delete timers[name]
    delete gameState.timers[name]
  }

  function restartTimers(){
    for (var name in gameState.timers){
      // console.log("timers: ", gameState.timers[name].func)
      startTimer(name, gameState.timers[name].end, gameState.timers[name].func, ...gameState.timers[name].args)
    }
  }


  function findActionByName(actions, name){
    return _(actions).find((action) => action.name === name)
  }

  function hasScript(object, keyword){
    return object && object.actions && findActionByName(object.actions, keyword) && findActionByName(object.actions, keyword).script
  }

  function setPart(index){
    gameState.currentPart = gameState.parts[index]
    gameState.currentScene = findScene(gameState.currentPart.openingScene || gameState.currentPart.sceneList[0].name)
    var partIntro = gameState.currentPart.intro || []
    var outputQueue = partIntro.slice()
    playCurrentScene(outputQueue)
  }

  function play(text, audio){
    playAudio([{text: text, audio: audio}])
  }

  function playMultiple(output){
    playAudio(output)
  }

  function singlePlay(text, audio){
    playAudio([{text: text, audio: audio}])
  }

  // function startTimer(name, millis, func){
  //   gameState.timers = gameState.timers || {}
  //   var args = _.map(arguments, (val, key) => {
  //     if(key > 2) return val
  //   })
  //   args = _.filter(args, (a) => a !== undefined)
  //   gameState.timers[name] = setTimeout(func, millis, ...args)
  // }
  //
  //
  //
  // function getTimer(name){
  //   return gameState.timers[name]
  // }
  //
  // function stopTimer(name){
  //   clearTimeout(gameState.timers[name])
  // }

  function isVisible(name){
     return getAvailableItems().includes(name)
  }

  function setAttribute(objectName, attribute, value){
    findObjectByName(objectName)[attribute] = value
  }

  function getAttribute(objectName, attribute){
    return findObjectByName(objectName)[attribute]
  }

  function changeInSceneDescription(objectName, description){
    setAttribute(objectName, "inSceneDescription", description)
  }

  function changeDescription(objectName, description){
    setAttribute(objectName, "description", description)
  }

  function addExit(sceneName, dir, scene, text, audio){
    findScene(sceneName).exits.push({direction: dir, scene: scene, text: text, audio: audio})
  }

  function addExitAtIndex(index, sceneName, dir, scene, text, audio){
    findScene(sceneName).exits.splice(index, 0, {direction: dir, scene: scene, text: text, audio: audio})
  }

  function addBidirectionalExit(scene1, dir1, scene2, dir2){
    findScene(scene1).exits.push({direction: dir1, scene: scene2})
    findScene(scene2).exits.push({direction: dir2, scene: scene1})
  }

  function addBidirectionalExitWithDescriptions(scene1, dir1, description1, scene2, dir2, description2){
    findScene(scene1).exits.push({direction: dir1, scene: scene2, text: description1.text, audio: description1.audio})
    findScene(scene2).exits.push({direction: dir2, scene: scene1, text: description2.text, audio: description2.audio})
  }

  function addBidirectionalExitWithDescriptionsAtIndex(scene1, dir1, description1, index1, scene2, dir2, description2, index2){
    if(!index2){
      index2 = index1
    }
    findScene(scene1).exits.splice(index1, 0, {direction: dir1, scene: scene2, text: description1.text, audio: description1.audio})
    findScene(scene2).exits.splice(index2, 0, {direction: dir2, scene: scene1, text: description2.text, audio: description2.audio})
  }

  function removeExit(sceneName, dir){
    var scene = findScene(sceneName)
    scene.exits = _.filter(scene.exits, exit => exit.direction !== dir )
  }

  function clearExits(sceneName){
    var scene = findScene(sceneName)
    scene.exits = []
  }

  function changeExitDescription(sceneName, direction, text, audio){
    var exit = _.findWhere(findScene(sceneName).exits, {direction: direction})
    exit.text = text
    exit.audio = audio
  }

  function removeFromFastTravel(sceneName){
    gameState.fastTravel = _.reject(gameState.fastTravel, scene => scene.name.toLowerCase() === sceneName.toLowerCase())
  }

  function addToFastTravel(sceneName){
    var scene = findScene(sceneName)
    gameState.fastTravel.push(scene)
  }

  function removeBulkFastTravel(sceneNames){
    sceneNames = sceneNames.map(scene => scene.toLowerCase())
    gameState.fastTravel = _.reject(gameState.fastTravel, scene => sceneNames.includes(scene.name.toLowerCase()))
  }

  function addBulkFastTravel(sceneNames){
    for (var sn of sceneNames){
      var scene = findScene(sn)
      gameState.fastTravel.push(scene)
    }
  }

  function addItemToScene(item, scene){
    findScene(scene).items.push(item.toLowerCase())
  }

  function addItemToSceneAtIndex(item, scene, index){
    findScene(scene).items.splice(index, 0, item.toLowerCase())
  }

  function replaceItemInScene(item, newItem, scene){
    item = item.toLowerCase()
    newItem = newItem.toLowerCase()
    var itemList
    if(!scene){
      itemList = gameState.currentScene.items
    }else{
      itemList = findScene(scene).items
    }
    var index = itemList.indexOf(item);
    if (index !== -1) {
        itemList[index] = newItem.toLowerCase();
    }
  }

  function removeItemFromScene(item, sceneName){
    var scene = findScene(sceneName)
    scene.items = _.without(scene.items, item.toLowerCase())
  }

  function addItemToInventory(item){
    gameState.inventory.push(item.toLowerCase())
  }

  function removeItemFromInventory(item){
    gameState.inventory = _.without(gameState.inventory, item.toLowerCase())
  }

  function takeItem(item){
    removeItemFromScene(item, gameState.currentScene.name.toLowerCase())
    addItemToInventory(item)
  }

  function replaceItemInInventory(item, newItem){
    var index = gameState.inventory.indexOf(item);
    if (index !== -1) {
        gameState.inventory[index] = newItem.toLowerCase();
    }
  }

  function hasItem(name){
    return gameState.inventory.includes(name.toLowerCase())
  }

  function removeAlias(object, alias){
    var thing = findObjectByName(object)
    thing.aliases =  _.reject(thing.aliases, al => al.toLowerCase() === alias.toLowerCase())
  }

  function addAlias(object, alias){
    alias =  alias.toLowerCase().trim()
    var thing = findObjectByName(object)
    thing.aliases.push(alias)
    if(!_(gameState.objectKeys).contains(alias)){
      gameState.objectKeys.push(alias)
    }
  }

  function changeInventoryName(object, text, audio){
    setAttribute(object, "inventory", {text: text, audio: audio})
  }

  function switchScene(scene){
    if (gameState.converseWith) gameState.converseWith = null
    gameState.currentScene = findScene(scene)
    playCurrentScene([], true)
  }

  function silentSwitchScene(scene){
    gameState.currentScene = findScene(scene)
  }

  function currentSceneIs(sceneName) {
    return gameState.currentScene.name.toLowerCase() === sceneName.toLowerCase()
  }

  function callFunction(func, ...params){
    gameState[func](...params)
  }

  function callAction(action_name, object){
    var item = findObjectByName(object)
    var action = findActionByName(item.actions , action_name)
    if(action && action.script){
      eval(action.script)
    }
  }

  function askAboutTopic(object, topic){
    var topic =  topic.toLowerCase().trim()
    var firstObject = findObjectByName(object)
    if (firstObject && firstObject.topics) {
      var topic = findTopicByAlias(firstObject, topic)
      if (topic && topic.broachable ){
        if (topic.script){
          eval(topic)
        }else{
          playInSequence(topic.response)
        }
      }else{
        playRandom(gameState.defaultResponses.ask)
      }
    }else{
      playRandom(gameState.defaultResponses.ask)
    }

  }

  function callCombination(verb, object1, object2){
    if (verb === "use") verb = "combine"
    var firstObject = findObjectByName(object1)
    var secondObject = findObjectByName(object2)
    var comb =  findCombination(verb, firstObject, secondObject)
    if (comb){
      if (comb.responses){
        playInSequence(comb.responses)
      }
      if(comb.script){
        eval(comb.script)
      }
    }
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

  function setFlag(objectName, flagName){
    findObjectByName(objectName).flags[flagName] = true
  }

  function removeFlag(objectName, flagName){
    findObjectByName(objectName).flags[flagName] = false
  }


  function getFlag(objectName, flagName){
    return findObjectByName(objectName).flags[flagName] || false
  }

  function playDescription(objectName){
    var item = findObjectByName(objectName)
    if(item.cycle){
      playCycle(item.description)
    }else{
      playInSequence(item.description)
    }
  }

  function makeBroachable(objectName, topic){
    var item = findObjectByName(objectName)
    var topicObj = _(item.topics).find((top) => top.name === topic)
    topicObj.broachable = true
  }

  function isBroachable(objectName, topic){
    var item = findObjectByName(objectName)
    var topicObj = _(item.topics).find((top) => top.name === topic)
    return topicObj.broachable
  }

  function makeUnbroachable(objectName, topic){
    var item = findObjectByName(objectName)
    var topicObj = _(item.topics).find((top) => top.name === topic)
    topicObj.broachable = false
  }

  function startConversation(name){
    var person = findObjectByName(name)
    if (person.topics && Object.keys(person.topics).length > 0){
      if (hasScript(person, "talk to")){
        eval(findActionByName(person.actions, "talk to" )) // not sure about this.
      }
      gameState.converseWith = person
      var action = findActionByName(person.actions, "talk to" )
      var greeting = action ? action.greeting : null
      if(greeting) playInSequence(greeting)
      listTopics(person)
    }else{
      playRandom(gameState.defaultResponses.ask)
    }
  }

  function once(){
    gameState.scriptor.script =  null
  }


  return {
    play,
    playMultiple,
    singlePlay,
    setFlag,
    getFlag,
    removeFlag,
    playDescription,
    makeUnbroachable,
    makeBroachable,
    once,
    playInSequence,
    playRandom,
    playCycle,
    callFunction,
    startTimer,
    hasItem,
    switchScene,
    currentSceneIs,
    stopTimer,
    restartTimers,
    addItemToScene,
    removeItemFromScene,
    addItemToInventory,
    addItemToSceneAtIndex,
    takeItem,
    removeItemFromInventory,
    replaceItemInScene,
    replaceItemInInventory,
    removeExit,
    addExit,
    addExitAtIndex, //document
    addBidirectionalExit,
    addBidirectionalExitWithDescriptionsAtIndex, //document
    addBidirectionalExitWithDescriptions,
    isVisible,
    setAttribute,
    getAttribute,
    changeInSceneDescription,
    changeDescription,
    setPart,
    removeFromFastTravel,
    addToFastTravel,
    removeBulkFastTravel,
    addBulkFastTravel,
    startConversation,
    isBroachable,
    callAction,
    callCombination,
    askAboutTopic,
    addAlias,
    removeAlias,
    changeInventoryName,
    changeExitDescription,
    silentSwitchScene,
    gameState,
    findScene,
    listExits,
    listInventory: playInventory,
    _
  }

}
