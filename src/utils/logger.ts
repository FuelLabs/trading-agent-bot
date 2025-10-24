import pino from 'pino';

export function createLogger(logLevel: string = 'info') {
  return pino({
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      level: logLevel,
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  });
}
