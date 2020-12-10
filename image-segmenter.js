/* global tf, Image, FileReader, ImageData, fetch */

const modelUrl = './model.json'

const colorMapUrl = './assets/color-map.json'

const imageSize = 512

let targetSize = { w: imageSize, h: imageSize }
let model
let imageElement
let colorMap

/**
 * load the TensorFlow.js model
 */
window.loadModel = async function () {
  tf.setBackend('wasm');
  disableElements()
  message('loading model...')

  let start = (new Date()).getTime()

  model = await tf.loadLayersModel(modelUrl)

  let end = (new Date()).getTime()

  message(model.modelUrl)
  message(`model loaded in ${(end - start) / 1000} secs`, true)
  enableElements()
}

/**
 * handle image upload
 *
 * @param {DOM Node} input - the image file upload element
 */
window.loadImage = function (input) {
  if (input.files && input.files[0]) {
    disableElements()
    message('resizing image...')

    let reader = new FileReader()

    reader.onload = function (e) {
      let src = e.target.result

      document.getElementById('canvasimage').getContext('2d').clearRect(0, 0, targetSize.w, targetSize.h)
      document.getElementById('canvassegments').getContext('2d').clearRect(0, 0, targetSize.w, targetSize.h)

      imageElement = new Image()
      imageElement.src = src

      imageElement.onload = function () {
        let resizeRatio = imageSize / Math.max(imageElement.width, imageElement.height)
        targetSize.w = Math.round(resizeRatio * imageElement.width)
        targetSize.h = Math.round(resizeRatio * imageElement.height)

        let origSize = {
          w: imageElement.width,
          h: imageElement.height
        }
        imageElement.width = targetSize.w
        imageElement.height = targetSize.h

        let canvas = document.getElementById('canvasimage')
        canvas.width = targetSize.w
        canvas.height = targetSize.w
        canvas
          .getContext('2d')
          .drawImage(imageElement, 0, 0, targetSize.w, targetSize.h)

        message(`resized from ${origSize.w} x ${origSize.h} to ${targetSize.w} x ${targetSize.h}`)
        enableElements()
      }
    }

    reader.readAsDataURL(input.files[0])
  } else {
    message('no image uploaded', true)
  }
}

/**
 * run the model and get a prediction
 */
window.runModel = async function () {
  if (imageElement) {
    disableElements()
    message('running inference...')

    let img = preprocessInput(imageElement)
    console.log('model.predict (input):', img.dataSync())

    let start = (new Date()).getTime()

    const output = model.predict(img)

    let end = (new Date()).getTime()

    console.log('model.predict (output):', output.dataSync())
    await processOutput(output)

    message(`inference ran in ${(end - start) / 1000} secs`, true)
    enableElements()
  } else {
    message('no image available', true)
  }
}

/**
 * convert image to Tensor input required by the model
 *
 * @param {HTMLImageElement} imageInput - the image element
 */
function preprocessInput (imageInput) {
  console.log('preprocessInput started')

  let inputTensor = tf.browser.fromPixels(imageInput)
  inputTensor = tf.transpose(inputTensor, [2, 0, 1])

  // https://js.tensorflow.org/api/latest/#expandDims
  let preprocessed = inputTensor.expandDims().toFloat();

  console.log('preprocessInput completed:', preprocessed)
  return preprocessed
}

/**
 * convert model Tensor output to image data for previewing
 *
 * @param {Tensor} output - the model output
 */
async function processOutput (output) {
  console.log('processOutput started')

  console.log(output)

  let segMap = Array.from(output.dataSync())
  if (!colorMap) {
    await loadColorMap()
  }

  let segMapColor = segMap.map(seg => colorMap[seg])

  let canvas = document.getElementById('canvassegments')
  let ctx = canvas.getContext('2d')
  canvas.width = targetSize.w
  canvas.height = targetSize.h

  let data = []
  for (var i = 0; i < segMapColor.length; i++) {
    data.push(segMapColor[i][0]) // red
    data.push(segMapColor[i][1]) // green
    data.push(segMapColor[i][2]) // blue
    data.push(175) // alpha
  }

  let imageData = new ImageData(targetSize.w, targetSize.h)
  imageData.data.set(data)
  ctx.putImageData(imageData, 0, 0)

  console.log('processOutput completed:', imageData)
}

async function loadColorMap () {
  let response = await fetch(colorMapUrl)
  colorMap = await response.json()

  if (colorMap && colorMap.hasOwnProperty('colorMap')) {
    colorMap = colorMap['colorMap']
  } else {
    console.warn('failed to fetch colormap')
    colorMap = []
  }
}

function disableElements () {
  const buttons = document.getElementsByTagName('button')
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('disabled', true)
  }

  const inputs = document.getElementsByTagName('input')
  for (var j = 0; j < inputs.length; j++) {
    inputs[j].setAttribute('disabled', true)
  }
}

function enableElements () {
  const buttons = document.getElementsByTagName('button')
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].removeAttribute('disabled')
  }

  const inputs = document.getElementsByTagName('input')
  for (var j = 0; j < inputs.length; j++) {
    inputs[j].removeAttribute('disabled')
  }
}

function message (msg, highlight) {
  let mark = null
  if (highlight) {
    mark = document.createElement('mark')
    mark.innerText = msg
  }

  const node = document.createElement('div')
  if (mark) {
    node.appendChild(mark)
  } else {
    node.innerText = msg
  }

  document.getElementById('message').appendChild(node)
}

function init () {
  message(`tfjs version: ${tf.version.tfjs}`, true)
}

// ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  setTimeout(init, 500)
}
