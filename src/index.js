import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import GameView from './GameView';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<GameView />, document.getElementById('root'));
registerServiceWorker();
