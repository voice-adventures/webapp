
module.exports = (combo) => {
  console.log(combo)
  if(combo.aliasGrammars["combine, give, show"]) {
    combo.aliasGrammars = {
      "combine": "either",
      "give": "either",
      "show": "either"
    }
  }
}
