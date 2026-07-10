// utils/singboxParser.js

export function generateSingboxConfig(rawLink) {
  if (rawLink.startsWith('vless://')) {
    return parseVless(rawLink);
  }
  // В будущем сюда можно добавить `else if (rawLink.startsWith('trojan://'))`
  throw new Error('Пока поддерживается только протокол VLESS');
}

function parseVless(link) {
  // Разбиваем ссылку: vless://uuid@host:port?query#name
  const [main, _hash] = link.split('#');
  const [protocol, rest] = main.split('://');
  const [uuid, urlAndQuery] = rest.split('@');
  
  const [hostPort, queryStr] = urlAndQuery.split('?');
  const [server, port] = hostPort.split(':');

  // Парсим параметры из части с вопросительным знаком
  const query = {};
  if (queryStr) {
    queryStr.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      query[key] = decodeURIComponent(value);
    });
  }

  // 1. Базовый шаблон конфига Sing-box для iOS
  const config = {
    log: { level: "info" },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        interface_name: "utun", // Виртуальный интерфейс iOS
        inet4_address: "198.18.0.1/16", // Локальный IP туннеля
        auto_route: true, // Автоматически заворачивать трафик
        strict_route: true,
        stack: "system", // Использовать сетевой стек Apple
        sniff: true // Для правильной маршрутизации доменов
      }
    ],
    outbounds: [
      {
        type: "vless",
        tag: "proxy",
        server: server,
        server_port: parseInt(port),
        uuid: uuid,
        packet_encoding: "xudp",
        flow: query.flow || ""
      },
      { type: "direct", tag: "direct" },
      { type: "dns", tag: "dns-out" }
    ],
    route: {
      rules: [
        { protocol: "dns", outbound: "dns-out" }
      ],
      auto_detect_interface: true
    }
  };

  // 2. Накручиваем настройки безопасности (Reality или обычный TLS)
  if (query.security === 'reality') {
    config.outbounds[0].tls = {
      enabled: true,
      server_name: query.sni || server,
      utls: {
        enabled: true,
        fingerprint: query.fp || "chrome"
      },
      reality: {
        enabled: true,
        public_key: query.pbk,
        short_id: query.sid || ""
      }
    };
  } else if (query.security === 'tls') {
    config.outbounds[0].tls = {
      enabled: true,
      server_name: query.sni || server,
      utls: {
        enabled: true,
        fingerprint: query.fp || "chrome"
      }
    };
  }

  // Возвращаем строку, так как Swift-мост ждет String
  return JSON.stringify(config);
}