import React, { Component } from 'react'
import {GameEngineFromSpec, GameEngineFromYaml} from './game-engine/GameEngine'
import GameCommandInput from './GameCommandInput'
import GameTextOutput from './GameTextOutput'
import './GameView.css'
import jesusQuest from './games/JesusQuest.json'
import TheNexus from './games/The_Nexus.json'
import runPatches from './runPatches'

var replaying = null

export default class GameView extends Component {
  constructor(props) {
    super(props)
    var game = localStorage.getItem("game")
    if(game){
      var output = localStorage.getItem("output")
      if (output) output = JSON.parse(output)
      this.state = {
        gameEngine: GameEngineFromYaml(game, (output, done, append) => this.receiveGameOutput(output, done, append), (output, done) => this.handleAudio(output, done), (output) => this.handleCommands(output), (yaml) => this.save(yaml)
        ),
        output : output || [""],
        currentSound: null,
        currentPart: props.currentPart,
        currentScene: props.currentScene,
        first: true
      }
    }else{
      game = TheNexus
      game.currentScene =  props.currentScene
      game.currentPart = props.currentPart
      this.state = {
        gameEngine:  GameEngineFromSpec(game, (output, done, append) => this.receiveGameOutput(output, done, append), (output, done) => this.handleAudio(output, done), (output) => this.handleCommands(output), (yaml) => this.save(yaml)),
        output : [""],
        currentSound: null,
        currentPart: props.currentPart,
        currentScene: props.currentScene,
        first: true
      }
    }
  }

  scrollToBottom() {
    // const scrollHeight = this.outputDiv.scrollHeight;
    // const height = this.outputDiv.clientHeight;
    const lastHeight = document.getElementById("last").scrollIntoView();
    // const maxScrollTop = scrollHeight - height - lastHeight;
    // this.outputDiv.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
  }

  componentDidMount() {
    setTimeout( () => this.state.gameEngine.start(), 0)
    this.scrollToBottom();
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  new(){
    var game = TheNexus
    game.currentScene =  this.props.currentScene
    game.currentPart = this.props.currentPart
    this.setState({
      gameEngine:  GameEngineFromSpec(game, (output, done, append) => this.receiveGameOutput(output, done, append), (output, done) => this.handleAudio(output, done), (output) => this.handleCommands(output), (yaml) => this.save(yaml)),
      output : [""],
      currentSound: null,
      currentPart: this.props.currentPart,
      currentScene: this.props.currentScene,
      first: true
    })

    setTimeout(() => this.state.gameEngine.start(), 0)
  }

  save(yaml){
    localStorage.setItem("game", yaml)
    localStorage.setItem("output", JSON.stringify(this.state.output))
  }

  load(){
    var game = localStorage.getItem("game")
    var output = localStorage.getItem("output")
    if (output) output = JSON.parse(output)
    this.setState({
      gameEngine: GameEngineFromYaml(game, (output, done, append) => this.receiveGameOutput(output, done, append), (output, done) => this.handleAudio(output, done), (output) => this.handleCommands(output), (yaml) => this.save(yaml)
      ),
      output : output || [""],
      currentSound: null,
      currentPart: this.props.currentPart,
      currentScene: this.props.currentScene,
      first: true
    })
  }

  render() {
    var scenes = []
    if (this.state.currentPart === 0 || this.state.currentPart){
      scenes =  this.props.game.parts[this.state.currentPart].sceneList
    }
    return (
      <div>
        <div className="page" ref={(div) => {
            this.outputDiv = div;
          }} >
              <div style={{width: "500px", margin: "0 auto"}} >
                  <GameTextOutput text={this.state.output}/>
              </div>
        </div>
        <div className="commands">
          <GameCommandInput onSubmit={(cmd) => this.submitCommand(cmd)} />
          <div style={{textAlign: "center", marginBottom: "50px",}}>
            <div className="button" style={{ marginLeft: "12px"}} onClick={() => this.new()}>New</div>
            <div className="button" style={{ marginLeft: "12px"}} onClick={() => this.save(this.state.gameEngine.getYaml())}>Save</div>
            <div className="button" style={{ marginLeft: "12px"}} onClick={() => this.load()}>Load</div>
          </div>
        </div>
      </div>
    )

  }

  receiveGameOutput(output, done, append) {
    // if(done){
    //   return
    // }
    // console.log("getting output")
    // this.playAudio(output, done)
    // var newOutput = this.state.output.slice()
    // newOutput[newOutput.length - 1] += " " + output
    // this.setState({output: newOutput})

    if(this.state.currentSound && append){
      console.log("returning without playing", this.state.currentSound, append, done)
      return true
    }
    if(done){
      if(replaying){
        this.replay()
      }
      return false
    }
    console.log("getting output")
    var newOutput = this.state.output.slice()
    console.log(newOutput)
    newOutput[newOutput.length - 1] += (/[.,\/#!$%\^&\*;:{}=\-_`~()]/.test(output.text) && output.text.length === 1) ? output.text : " " + output.text
    console.log(output.text)
    this.setState({output: newOutput})
    this.playAudio(output.audio, done)
    return false
  }

  playAudio(output, done){
    console.log("playing audio")
    if(done){
      if(replaying){
        this.replay()
      }
      return
    }
    if (this.state.currentSound) this.state.currentSound.stop()
    this.state.gameEngine.audioFinished()
  }

  submitCommand(cmd) {
    if (this.state.currentSound){
      this.state.currentSound.stop()
      this.setState({currentSound: null})
    }
    this.state.gameEngine.submitCommand(cmd)
  }

  handleCommands(cmd){
    var newOutput = this.state.output.slice()
    newOutput.push({text: cmd, src: 'cmd'})
    newOutput.push("")
    this.setState({output: newOutput})
  }

  handleAudio(output, done){
    if(done){
      if(replaying){
        this.replay()
      }
      return
    }
    if (this.state.currentSound) this.state.currentSound.stop()
    this.state.gameEngine.audioFinished()

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
