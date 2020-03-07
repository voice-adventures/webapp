const _ = require('underscore')

module.exports = (game, path, func) => {
  var place = game.gameState
  for(var p of path){
    if(Array.isArray(place)){
      place = _.find(place, pl => pl.name.toLowerCase() === p.toLowerCase())
    }else {
      place = place[p]
    }
  }
  func(place)
}
