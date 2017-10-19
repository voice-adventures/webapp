import React, { Component } from 'react'

export default class GameCommandInput extends Component {
  constructor(props) {
    super(props)
    this.state = {
      command: ''
    }
    this.submit = this.submit.bind(this)
    this.handleChange = this.handleChange.bind(this)
  }

  onEnter(event){
    if(event.keyCode == 13) document.getElementById('submit').click()
  }

  render() {
    return <div style={{marginBottom: "200px", textAlign: "center"}}>
      <input type="text" onChange={this.handleChange} value={this.state.command} onKeyDown={(event) => this.onEnter(event)}/>
      <button id="submit" onClick={this.submit}>make it so!</button>
    </div>
  }

  handleChange(event) {
    this.setState({command: event.target.value})
  }

  submit() {
    this.props.onSubmit(this.state.command)
    this.setState({command: ''})
  }
}
