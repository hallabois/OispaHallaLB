import os from "os";
import winston from "winston";
import { Syslog, SyslogTransportInstance } from "winston-syslog";

const format = winston.format.combine(
  // winston.format.timestamp({ format: "MMM DD HH:mm:ss:SS Z" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.level}: ${info.message}`)
);

const console = new winston.transports.Console({
  handleExceptions: true,
  handleRejections: true,
});
const transports: (
  | SyslogTransportInstance
  | winston.transports.ConsoleTransportInstance
)[] = [console];

if (process.env.PAPERTRAIL_SERVER && process.env.PAPERTRAIL_PORT) {
  const papertrail = new Syslog({
    host: `logs${process.env.PAPERTRAIL_SERVER}.papertrailapp.com`,
    port: +process?.env?.PAPERTRAIL_PORT!,
    protocol: "tls4",
    localhost: os.hostname(),
    eol: "\n",
    handleExceptions: true,
    handleRejections: true,
  });
  transports.push(papertrail);
}

export const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  format,
  transports,
  exitOnError: false,
});

export default logger;
