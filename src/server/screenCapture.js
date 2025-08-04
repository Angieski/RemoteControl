const { Monitor } = require('node-screenshots');
const sharp = require('sharp');

class ScreenCapture {
  constructor() {
    this.quality = 80;
    this.scale = 1.0;
    this.format = 'jpeg';
  }

  async captureScreen() {
    try {
      // Capturar tela principal
      const displays = Monitor.all();
      if (displays.length === 0) {
        throw new Error('Nenhum display encontrado');
      }

      const primaryDisplay = displays[0];
      const image = primaryDisplay.captureImageSync();
      
      // Converter para PNG primeiro e depois usar Sharp
      const pngBuffer = image.toPngSync();
      const processedImage = await sharp(pngBuffer)
        .resize(
          Math.floor(primaryDisplay.width() * this.scale),
          Math.floor(primaryDisplay.height() * this.scale)
        )
        .jpeg({ quality: this.quality })
        .toBuffer();

      return processedImage;
    } catch (error) {
      console.error('Erro na captura de tela:', error);
      throw error;
    }
  }

  async captureRegion(x, y, width, height) {
    try {
      const displays = Monitor.all();
      const primaryDisplay = displays[0];
      
      const image = primaryDisplay.captureImageSync();
      const pngBuffer = image.toPngSync();
      
      const processedImage = await sharp(pngBuffer)
        .extract({ left: x, top: y, width, height })
        .jpeg({ quality: this.quality })
        .toBuffer();

      return processedImage;
    } catch (error) {
      console.error('Erro na captura de região:', error);
      throw error;
    }
  }

  setQuality(quality) {
    this.quality = Math.max(1, Math.min(100, quality));
  }

  setScale(scale) {
    this.scale = Math.max(0.1, Math.min(2.0, scale));
  }

  getDisplayInfo() {
    try {
      const displays = Monitor.all();
      return displays.map(display => ({
        id: display.id(),
        width: display.width(),
        height: display.height(),
        isPrimary: display.isPrimary()
      }));
    } catch (error) {
      console.error('Erro ao obter informações do display:', error);
      return [];
    }
  }
}

module.exports = ScreenCapture;