import './style.css'
import './ui.css'
import { Experience } from './Experience.js'

const exp = new Experience(
  document.querySelector('#scene'),
  document.querySelector('#ui')
)
exp.init()
