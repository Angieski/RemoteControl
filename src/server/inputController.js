const robot = require('@hurdlegroup/robotjs');

class InputController {
  constructor() {
    // Configurar velocidade do mouse
    robot.setMouseDelay(2);
    robot.setKeyboardDelay(10);
    
    this.screenSize = robot.getScreenSize();
    console.log(`Resolução da tela: ${this.screenSize.width}x${this.screenSize.height}`);
  }

  async processInput(event) {
    try {
      switch (event.type) {
        case 'mouseMove':
          this.handleMouseMove(event);
          break;
          
        case 'mouseClick':
          this.handleMouseClick(event);
          break;
          
        case 'mouseWheel':
          this.handleMouseWheel(event);
          break;
          
        case 'keyPress':
          this.handleKeyPress(event);
          break;
          
        case 'keyDown':
          this.handleKeyDown(event);
          break;
          
        case 'keyUp':
          this.handleKeyUp(event);
          break;
          
        default:
          console.warn(`Tipo de evento não suportado: ${event.type}`);
      }
    } catch (error) {
      console.error('Erro ao processar input:', error);
      throw error;
    }
  }

  handleMouseMove(event) {
    const { x, y } = event;
    
    // Garantir que as coordenadas estão dentro dos limites da tela
    const clampedX = Math.max(0, Math.min(this.screenSize.width - 1, x));
    const clampedY = Math.max(0, Math.min(this.screenSize.height - 1, y));
    
    robot.moveMouse(clampedX, clampedY);
  }

  handleMouseClick(event) {
    const { x, y, button = 'left', double = false } = event;
    
    if (x !== undefined && y !== undefined) {
      this.handleMouseMove({ x, y });
    }
    
    if (double) {
      robot.mouseClick(button, true); // double click
    } else {
      robot.mouseClick(button, false); // single click
    }
  }

  handleMouseWheel(event) {
    const { x, y, deltaX = 0, deltaY = 0 } = event;
    
    if (x !== undefined && y !== undefined) {
      this.handleMouseMove({ x, y });
    }
    
    // Robot.js usa scrollMouse(x, y) onde valores positivos rolam para cima
    if (deltaY !== 0) {
      const scrollAmount = Math.sign(deltaY) * 3; // Multiplicar para tornar mais responsivo
      robot.scrollMouse(0, -scrollAmount); // Inverter para comportamento natural
    }
    
    if (deltaX !== 0) {
      const scrollAmount = Math.sign(deltaX) * 3;
      robot.scrollMouse(-scrollAmount, 0);
    }
  }

  handleKeyPress(event) {
    const { key, modifiers = [] } = event;
    
    try {
      if (modifiers.length > 0) {
        // Pressionar com modificadores
        const keys = [...modifiers, key];
        robot.keyTap(key, modifiers);
      } else {
        robot.keyTap(key);
      }
    } catch (error) {
      console.error(`Erro ao pressionar tecla: ${key}`, error);
    }
  }

  handleKeyDown(event) {
    const { key } = event;
    
    try {
      robot.keyToggle(key, 'down');
    } catch (error) {
      console.error(`Erro ao pressionar tecla para baixo: ${key}`, error);
    }
  }

  handleKeyUp(event) {
    const { key } = event;
    
    try {
      robot.keyToggle(key, 'up');
    } catch (error) {
      console.error(`Erro ao soltar tecla: ${key}`, error);
    }
  }

  // Método para obter posição atual do mouse
  getMousePosition() {
    return robot.getMousePos();
  }

  // Método para mapear teclas especiais
  mapSpecialKeys(key) {
    const keyMap = {
      'Enter': 'enter',
      'Escape': 'escape',
      'Tab': 'tab',
      'Backspace': 'backspace',
      'Delete': 'delete',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Home': 'home',
      'End': 'end',
      'PageUp': 'pageup',
      'PageDown': 'pagedown',
      'Insert': 'insert',
      'CapsLock': 'capslock',
      'NumLock': 'numlock',
      'ScrollLock': 'scrolllock',
      'F1': 'f1', 'F2': 'f2', 'F3': 'f3', 'F4': 'f4',
      'F5': 'f5', 'F6': 'f6', 'F7': 'f7', 'F8': 'f8',
      'F9': 'f9', 'F10': 'f10', 'F11': 'f11', 'F12': 'f12'
    };

    return keyMap[key] || key.toLowerCase();
  }

  // Método para validar se a tecla é suportada
  isValidKey(key) {
    try {
      robot.keyTap(key);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = InputController;