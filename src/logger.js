const PREFIX = '[love-bot]';

export function info(...args) {
  console.log(PREFIX, '[info]', ...args);
}

export function error(...args) {
  console.error(PREFIX, '[error]', ...args);
}
