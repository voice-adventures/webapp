const {GameEngineFromYaml} = require('./game-engine/GameEngine')
const fixFreebutlerTopic = require('./games/patches/fixFreebutlerTopic')
const patch = require('./game-engine/patch')

function save(yaml){
  localStorage.setItem("game", yaml)
  console.log("saved!!!")
}

let yaml = localStorage.getItem('game')
if(yaml){
  let game = GameEngineFromYaml(yaml, () => {}, () => {}, () => {}, save )

  patch(game, ["items", "freebutler", "topics", "maid_1"], fixFreebutlerTopic)

  console.log('patches run')


  game.submitCommand('save')
}
