
module.exports = (topic) => {
  console.log("fixing topic", topic)
  if(!topic.script){
    let str = `
    if (!getFlag('freebutler', 'maidbroached')) {
        setFlag('freebutler', 'maidbroached')
    }
    if (!getAttribute('freebutler', 'newletter')) {
        setAttribute('freebutler', 'newletter', [
            {
                text: '"I see you’ve delivered my letter. Thank you. But I’m worried I didn’t say enough. She’s such a wonderful woman and I’d hate to lose her. Sorry to be a bother, but would you mind fetching another bouquet? I’d like to send her another letter."',
                audio: 'ad654fdfa',
                character: 'freebutler'
            },
            {
                text: '"I’d like to send her another letter, would you mind fetching another lovely bouquet of petunias?"',
                audio: '54adfnav',
                character: 'freebutler'
            }
        ])
    }
    if (!getAttribute('freebutler', 'maid')) {
        setAttribute('freebutler', 'maid', [
            {
                text: '"My darling Cosette! She must be beside herself with worry. I must see her at once."\\n\\n The Butler starts for the door, but stops when he sees himself in the mirror.\\n\\n"Dear god, look at the state of me. I can’t let her see me like this. Oh, but I must let her know I’m all right. I shall write to her."\\n\\n He pulls a pen and paper from his jacket and begins writing.\\n\\n"I’ll also need to give her something by way of an apology for my long absence. Something beautiful. Do you have anything like that?"',
                audio: '65a4dffha',
                character: 'freebutler_cutscene'
            },
            {
                text: '"Before I can send her this letter, I’ll need some sort of gift to include. Something beautiful. Do you have anything like that?"',
                audio: 'lkj1258a5hmc',
                character: 'freebutler'
            }
        ])
    }
    if (getFlag('maid', 'gone')) {
        play('"I see you’ve delivered my letter! Did she just love it? Oooh, don’t tell me, don’t tell me. I’ll wait to hear it from her. She’s very passionate you know, I’d hate to ever be on her bad side!"', 'lkadh854ha', 'freebutler')
        makeUnbroachable('freebutler', 'maid_1')
    } else if (getFlag('freebutler', 'waiting')) {
        play('"Please deliver my gift to my fiancé as soon as possible!"', 'oiuahg47gnal', 'freebutler');
    } else if (getFlag('maid', 'firstdeliver')) {
        playCycle(getAttribute('freebutler', 'newletter'));
        if (!getFlag('notepad', 'beautifulcomplete') && !getFlag('notepad', 'getbeautiful')) {
            setFlag('notepad', 'getbeautiful');
        }
    } else {
        playInSequence(getAttribute('freebutler', 'maid'));
        if (!getFlag('notepad', 'beautifulcomplete') && !getFlag('notepad', 'getbeautiful')) {
            setFlag('notepad', 'getbeautiful');
            if (hasItem('notepad')) {
                play('\\n\\n You add "Find something beautiful for the butler" to your to-do list.', 'butlermaidtopic1');
            }
        }
    }
    `
    topic.script = str
  }
}
