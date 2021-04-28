require('dotenv/config');

const { Builder } = require('selenium-webdriver');
const AbortController = require('abort-controller');

const { readFile } = require('fs').promises;

const ONE_DAY = 86400000;

async function findHostIP() {
  // https://docs.microsoft.com/en-us/windows/wsl/compare-versions#accessing-windows-networking-apps-from-linux-host-ip
  const procVersion = await readFile('/proc/version');

  if (/wsl2/iu.test(procVersion)) {
    try {
      const content = await readFile('/etc/resolv.conf');

      return /^nameserver\s(.*)/mu.exec(content)[1];
    } catch (err) {}
  }

  return 'localhost';
}

function setAsyncInterval(fn, interval, signal) {
  const once = async () => {
    if (signal.aborted) {
      return;
    }

    try {
      await fn();
    } catch (err) {
      throw err;
    }

    schedule();
  };

  const schedule = () => {
    if (!signal.aborted) {
      setTimeout(once, interval);
    }
  };

  schedule();
}

function signalToReject(signal) {
  return new Promise(
    (_, reject) => signal && signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  );
}

function sleep(duration = 1000, signal) {
  return Promise.race([new Promise(resolve => setTimeout(resolve, duration)), signalToReject(signal)]);
}

const WEB_DRIVER_URL = 'http://chromium:4444/wd/hub/';
const WEB_SERVER_URL = 'http://webserver/';

async function main() {
  const searchParams = new URLSearchParams({
    key: process.env.ACS_KEY || '',
    token: process.env.ACS_TOKEN || '',
    url: process.env.ACS_ENDPOINT_URL || ''
  });

  for (;;) {
    console.log('Starting a new Chromium.');

    try {
      const abortController = new AbortController();
      const webDriver = await new Builder().forBrowser('chrome').usingServer(WEB_DRIVER_URL).build();

      const sessionId = (await webDriver.getSession()).getId();

      const terminate = async () => {
        // WebDriver.quit() will kill all async function for executeScript().
        // HTTP DELETE will kill the session.
        // Combining two will forcifully killed the Web Driver session immediately.
        try {
          webDriver.quit(); // Don't await or Promise.all on quit().
          await fetch(new URL(sessionId, WEB_DRIVER_URL), { method: 'DELETE' });
        } catch (err) {}
      };

      try {
        await webDriver.get(new URL(`?${searchParams}`, WEB_SERVER_URL));

        setAsyncInterval(
          async () => {
            try {
              await webDriver.getWindowHandle();
            } catch (err) {
              abortController.abort();
            }
          },
          2000,
          abortController.signal
        );

        await sleep(ONE_DAY, abortController.signal);
      } catch (err) {
      } finally {
        await terminate();
      }
    } catch (err) {
    } finally {
      await sleep(1000);
    }
  }
}

main().catch(err => {
  err.message === 'aborted' || console.error(err);

  process.exit();
});
