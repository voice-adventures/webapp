const {GameEngineFromYaml} = require('./game-engine/GameEngine')
const patch = require('./game-engine/patch')

const fixFreebutlerTopic = require('./games/patches/fixFreebutlerTopic')
const fixUsingRagWithDogs = require('./games/patches/fixUsingRagWithDogs')

function save(yaml){
  localStorage.setItem("game", yaml)
  console.log("saved!!!")
}

let yaml = localStorage.getItem('game')
if(yaml){
  let game = GameEngineFromYaml(yaml, () => {}, () => {}, () => {}, save )

  patch(game, ["items", "freebutler", "topics", "maid_1"], fixFreebutlerTopic)
  patch(game, ["combinations", "QjVh0oGi795FgYcv4BWKJbSvLCYbKPcd"], fixUsingRagWithDogs)

  console.log('patches run')


  game.submitCommand('save')
}
