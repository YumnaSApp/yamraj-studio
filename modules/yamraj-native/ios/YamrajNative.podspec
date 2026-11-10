Pod::Spec.new do |s|
  s.name           = 'YamrajNative'
  s.version        = '1.0.0'
  s.summary        = 'Yamraj Studio voice + video engine'
  s.description    = 'Offline Hindi TTS, music/SFX synth and 9:16 video export for Yamraj Studio'
  s.author         = 'Kamran'
  s.homepage       = 'https://github.com/YumnaSApp/yamraj-studio'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
