import React, { Component } from 'react'
import {GameEngineFromSpec} from './game-engine/GameEngine'
import GameCommandInput from './GameCommandInput'
import GameTextOutput from './GameTextOutput'

import jesusQuest from './games/JesusQuest.json'

export default class GameView extends Component {
  constructor(props) {
    super(props)
    var game = jesusQuest
    game.currentScene =  props.currentScene
    game.currentPart = props.currentPart
    this.state = {
      gameEngine: GameEngineFromSpec(game, (output) => {
        setTimeout(() => this.receiveGameOutput(output), 0)}, (output, done) => {
          setTimeout(() => this.handleAudio(output, done), 0)}, (output) => this.handleCommands(output), (yaml) => this.save(yaml)
      ),
      output : [""],
      currentSound: null,
      currentPart: props.currentPart,
      currentScene: props.currentScene
    }
  }

  scrollToBottom() {
    const scrollHeight = this.outputDiv.scrollHeight;
    const height = this.outputDiv.clientHeight;
    const maxScrollTop = scrollHeight - height;
    this.outputDiv.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
  }

  componentDidMount() {
    this.scrollToBottom();
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  save(yaml){
    //NOTHING
  }

  render() {
    var scenes = []
    if (this.state.currentPart === 0 || this.state.currentPart){
      scenes =  this.props.game.parts[this.state.currentPart].sceneList
    }
    return <div ref={(div) => {
        this.outputDiv = div;
      }} >
        <div style={{width: "500px", margin: "0 auto"}} >
            <GameTextOutput text={this.state.output}/>
            <GameCommandInput onSubmit={(cmd) => this.submitCommand(cmd)} />
        </div>
    </div>

  }

  receiveGameOutput(output) {
    var newOutput = this.state.output.slice()
    newOutput[newOutput.length - 1] += " " + output
    this.setState({output: newOutput})
  }


  submitCommand(cmd) {
    if (this.state.currentSound) this.state.currentSound.stop()
    this.state.gameEngine.submitCommand(cmd)
  }

  handleCommands(cmd){
    var newOutput = this.state.output.slice()
    newOutput.push({text: cmd, src: 'cmd'})
    newOutput.push("")
    this.setState({output: newOutput})
  }

  handleAudio(output, done){
    // if(done){
    //   return
    // }
    // if (this.state.currentSound) this.state.currentSound.stop()
    // if (output){
    //   output = this.props.audioPath + output
    //   var sound = new Howl({
    //     src: [output],
    //     onend: this.state.gameEngine.audioFinished
    //   });
    //   sound.play()
    //   this.setState({currentSound: sound})
    // }else{
    //   this.state.gameEngine.audioFinished()
    // }
  }
}
