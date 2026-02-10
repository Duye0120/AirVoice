import koffi from 'koffi';
import { clipboard, nativeImage, type NativeImage } from 'electron';

const user32 = koffi.load('user32.dll');

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const VK_CONTROL = 0x11;
const VK_V = 0x56;
const VK_RETURN = 0x0D;

const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
  wVk: 'uint16',
  wScan: 'uint16',
  dwFlags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr'
});

const INPUT = koffi.struct('INPUT', {
  type: 'uint32',
  ki: KEYBDINPUT,
  padding: koffi.array('uint8', 8)
});

const SendInput = user32.func('uint32 SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)');

interface InputStruct {
  type: number;
  ki: {
    wVk: number;
    wScan: number;
    dwFlags: number;
    time: number;
    dwExtraInfo: number;
  };
  padding: number[];
}

function makeKeyInput(vk: number, up: boolean): InputStruct {
  return {
    type: INPUT_KEYBOARD,
    ki: { wVk: vk, wScan: 0, dwFlags: up ? KEYEVENTF_KEYUP : 0, time: 0, dwExtraInfo: 0 },
    padding: new Array(8).fill(0)
  };
}

export function typeText(text: string, execute?: boolean): void {
  if (!text) return;

  const oldClipboard = clipboard.readText();
  const oldClipboardImage = clipboard.readImage();
  clipboard.writeText(text);

  const inputs: InputStruct[] = [
    makeKeyInput(VK_CONTROL, false),
    makeKeyInput(VK_V, false),
    makeKeyInput(VK_V, true),
    makeKeyInput(VK_CONTROL, true),
  ];

  if (execute) {
    inputs.push(makeKeyInput(VK_RETURN, false));
    inputs.push(makeKeyInput(VK_RETURN, true));
  }

  SendInput(inputs.length, inputs, koffi.sizeof(INPUT));

  // 延迟恢复剪贴板，确保粘贴操作完成
  // 使用重试机制提高成功率
  let retryCount = 0;
  const maxRetries = 3;
  const restoreClipboard = () => {
    try {
      const restoreData: { text?: string; image?: NativeImage } = {};
      if (oldClipboard) {
        restoreData.text = oldClipboard;
      }
      if (!oldClipboardImage.isEmpty()) {
        restoreData.image = oldClipboardImage;
      }

      if (restoreData.text || restoreData.image) {
        clipboard.write(restoreData);
      } else {
        clipboard.clear();
      }
    } catch (err) {
      retryCount++;
      if (retryCount < maxRetries) {
        setTimeout(restoreClipboard, 50);
      } else {
        console.warn('Failed to restore clipboard after retries:', err);
      }
    }
  };
  
  setTimeout(restoreClipboard, 200);
}

export function pasteImage(imageBuffer: Buffer, execute?: boolean): boolean {
  try {
    const image = nativeImage.createFromBuffer(imageBuffer);
    if (image.isEmpty()) {
      console.warn('Failed to parse image for clipboard paste');
      return false;
    }

    const oldClipboardText = clipboard.readText();
    const oldClipboardImage = clipboard.readImage();
    clipboard.writeImage(image);

    const inputs: InputStruct[] = [
      makeKeyInput(VK_CONTROL, false),
      makeKeyInput(VK_V, false),
      makeKeyInput(VK_V, true),
      makeKeyInput(VK_CONTROL, true),
    ];

    SendInput(inputs.length, inputs, koffi.sizeof(INPUT));

    if (execute) {
      setTimeout(() => {
        const enterInputs: InputStruct[] = [
          makeKeyInput(VK_RETURN, false),
          makeKeyInput(VK_RETURN, true),
        ];
        SendInput(enterInputs.length, enterInputs, koffi.sizeof(INPUT));
      }, 120);
    }

    let retryCount = 0;
    const maxRetries = 3;
    const restoreClipboard = () => {
      try {
        const restoreData: { text?: string; image?: NativeImage } = {};
        if (oldClipboardText) {
          restoreData.text = oldClipboardText;
        }
        if (!oldClipboardImage.isEmpty()) {
          restoreData.image = oldClipboardImage;
        }

        if (restoreData.text || restoreData.image) {
          clipboard.write(restoreData);
        } else {
          clipboard.clear();
        }
      } catch (err) {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(restoreClipboard, 50);
        } else {
          console.warn('Failed to restore clipboard after image paste:', err);
        }
      }
    };

    setTimeout(restoreClipboard, 800);
    return true;
  } catch (err) {
    console.warn('Failed to paste image:', err);
    return false;
  }
}
