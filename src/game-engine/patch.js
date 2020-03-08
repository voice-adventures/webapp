const _ = require('underscore')

module.exports = (game, path, func) => {
  var place = game.gameState
  for(var p of path){
    if(Array.isArray(place)){
      let new_place = _.find(place, pl => pl.name && pl.name.toLowerCase() === p.toLowerCase())
      if(!new_place){
        new_place = _.find(place, pl => pl.id === p)
      }
      place = new_place
    }else {
      place = place[p]
    }
  }
  func(place)
}
