// utils/singboxParser.js

export function generateSingboxConfig(rawLink) {
  if (!rawLink) throw new Error('Пустая ссылка сервера');
  
  if (rawLink.startsWith('vless://')) {
    return parseProtocol(rawLink, 'vless');
  } else if (rawLink.startsWith('trojan://')) {
    return parseProtocol(rawLink, 'trojan');
  }
  
  throw new Error(`Протокол не поддерживается: ${rawLink.split('://')[0]}`);
}

function parseProtocol(link, protocolType) {
  // Разбираем строку: protocol://credentials@host:port?query#name
  const [main, _hash] = link.split('#');
  const [protocol, rest] = main.split('://');
  
  if (!rest || !rest.includes('@')) {
    throw new Error('Неверный формат ссылки (отсутствует @)');
  }
  
  const [credentials, urlAndQuery] = rest.split('@');
  const [hostPort, queryStr] = urlAndQuery.split('?');
  const [server, port] = hostPort.split(':');

  if (!server || !port) {
    throw new Error('Не удалось определить IP или порт сервера');
  }

  // Безопасно парсим параметры (если они есть)
  const query = {};
  if (queryStr) {
    queryStr.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        query[key] = decodeURIComponent(value);
      }
    });
  }

  // Базовый шаблон конфига Sing-box для iOS (Network Extension)
  const config = {
    log: { level: "info" },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        interface_name: "utun", // Виртуальный интерфейс iOS
        inet4_address: "198.18.0.1/16",
        auto_route: true,
        strict_route: true,
        stack: "system", // Критично для iOS
        sniff: true
      }
    ],
    outbounds: [
      {
        type: protocolType, // "vless" или "trojan"
        tag: "proxy",
        server: server,
        server_port: parseInt(port)
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

  // Добавляем специфичные для протокола настройки
  if (protocolType === 'vless') {
    config.outbounds[0].uuid = credentials;
    config.outbounds[0].packet_encoding = "xudp";
    if (query.flow) config.outbounds[0].flow = query.flow;
  } else if (protocolType === 'trojan') {
    config.outbounds[0].password = credentials;
  }

  // Настраиваем шифрование (Reality / обычный TLS)
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
        public_key: query.pbk || "",
        short_id: query.sid || ""
      }
    };
  } else if (query.security === 'tls' || query.security === 'xtls') {
    config.outbounds[0].tls = {
      enabled: true,
      server_name: query.sni || server,
      utls: {
        enabled: true,
        fingerprint: query.fp || "chrome"
      }
    };
  }

  return JSON.stringify(config);
}
