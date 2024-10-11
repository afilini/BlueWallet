import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { PortalSdk, type NfcOut, type CardStatus } from 'libportal-react-native';

let sdk = null;
let keepReading = false;
let alreadyInited = false;
let livenessCheckInterval: NodeJS.Timeout;

function livenessCheck(): Promise<NfcOut> {
  return new Promise((_resolve, reject) => {
    livenessCheckInterval = setInterval(() => {
      NfcManager.nfcAHandler.transceive([0x30, 0xed])
        .catch(() => {
          NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
          clearInterval(livenessCheckInterval);

          reject(new Error('Removed tag'));
        });
    }, 250);
  });
}

async function manageTag() {
  await sdk.newTag();
  const check = livenessCheck();

  // eslint-disable-next-line no-unmodified-loop-condition
  while (keepReading && sdk) {
    const msg = await Promise.race([sdk.poll(), check]);
    // console.trace('>', msg.data);
    const result = await NfcManager.nfcAHandler.transceive(msg.data);
    // console.trace('<', result);
    await sdk.incomingData(msg.msgIndex, result);
    // await new Promise(resolve => setTimeout(resolve, 100)); // chance for UI to propagate
  }
}

async function listenForTags() {
  while (keepReading) {
    console.info('Looking for a Portal...');

    try {
      await NfcManager.registerTagEvent();
      await NfcManager.requestTechnology(NfcTech.NfcA, {});
      await manageTag();
    } catch (ex) {
      console.warn('Oops!', ex);
    } finally {
      await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
    }

    // await new Promise(resolve => setTimeout(resolve, 100)); // chance for UI to propagate
  }
}

export const init = () => {
  if (alreadyInited) return;

  return NfcManager.isSupported().then(value => {
    if (value) {
      console.log('NFC read starting...');
      NfcManager.start()
        .then(() => {
          alreadyInited = true;
        });
    } else {
      throw new Error('NFC not supported');
    }
  });
};

export const startReading = async () => {
  if (keepReading) return; // protect from double calls

  if (!alreadyInited) {
    await init();
  }

  sdk = new PortalSdk(true);
  keepReading = true;
  listenForTags();
};

export const stopReading = () => {
  keepReading = false;

  sdk.destroy();
  sdk = null;

  // clearTimeout(livenessCheckInterval);
  return NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
};

export const getStatus = async (): CardStatus => {
  return sdk.getStatus();
};

export const unlock = async (pass: string) => {
  return sdk.unlock(pass);
};

export const publicDescriptors = async () => {
  return sdk.publicDescriptors();
};

export const isReading = () => {
  return keepReading;
};
