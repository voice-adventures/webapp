import React, { Component } from 'react'

export default class GameTextOutput extends Component {
  render() {
    return <div style={{marginTop: 10}}>
      {
        this.props.text.map((line, i) => {
          if (line.src){
            return  <p style={style} key={i}>{line.text}</p>
          }else{
            return <p style={{whiteSpace: 'pre-line', marginLeft: "20px", fontSize: "16px", textAlign: "left"}}key={i}>{line}</p>
          }
        })
      }
    </div>
  }
}


var style = {
  textAlign: "right",
  fontSize: "16px",
  marginRight: "20px"
}
// return <div>
//   {
//     this.props.text.map((line, i) => <p style={line.src === 'cmd' ? style : {}} key={i}>{line.text}</p>)
//   }
// </div>
