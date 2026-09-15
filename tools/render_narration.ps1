$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assetDir = Join-Path $root 'video-assets'
$voiceDir = Join-Path $assetDir 'voice'
New-Item -ItemType Directory -Path $voiceDir -Force | Out-Null

Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Zira Desktop')
$speaker.Rate = 2
$speaker.Volume = 100

$entries = Get-Content -LiteralPath (Join-Path $assetDir 'narration.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $entries) {
  $target = Join-Path $voiceDir ($entry.id + '.wav')
  $speaker.SetOutputToWaveFile($target)
  $speaker.Speak([string]$entry.narration)
  $speaker.SetOutputToNull()
  Write-Output $target
}
$speaker.Dispose()
