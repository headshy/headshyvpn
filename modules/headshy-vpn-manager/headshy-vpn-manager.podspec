require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'headshy-vpn-manager'
  s.version        = package['version']
  s.summary        = package['name']
  s.description    = package['name']
  s.license        = 'MIT'
  s.author         = 'Headshy'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '13.0' }
  s.swift_version  = '5.4'
  s.source         = { :git => '' }
  s.static_framework = true

  # Связываем наш модуль с ядром Expo
  s.dependency 'ExpoModulesCore'

  # Указываем путь к нашему Swift-коду
  s.source_files = "ios/**/*.{h,m,swift}"
end