let speechSynthesis = window.speechSynthesis;
let TARGET_ID = "CaptionSpeakerData";
let PLAYER_RESPONSE_ATTRIBUTE_NAME = "ytplayer.config.args.player_response";
var prevSpeakTime = "";
var playLocale = window.navigator.language;
var captionData = {};
var isEnabled = false;

var voicePitch = 1.0;
var voiceRate = 1.6;
var voiceVolume = 1.0;
var voiceVoice = undefined;

// Youtube$B$N(Bscript$BB&$G@_Dj$7$F$$$k(B ytplayer.config.args.player_response ($BCf?H$O(B JSON$BJ8;zNs(B) $B$r!"(Bbody$B$K(B<script></script> $B$rKd$a9~$`7A$G<h$j=P$7$^$9!#(B
let INJECT_SCRIPT = `
document.getElementById("${TARGET_ID}").setAttribute("${PLAYER_RESPONSE_ATTRIBUTE_NAME}", ytplayer.config.args.player_response)
`;

function RemoveInjectElement(idText){
  document.getElementById(idText)?.remove();
}

function InjectScript(scriptText, idText){
  let element = document.createElement('script');
  element.textContent = scriptText;
  if(idText){
    element.id = idText;
  }
  document.body.appendChild(element);
}

// ytplayer.config.args.player_response $B$NCf$K4^$^$l$F$$$k;zKk$N>pJs$+$i(B
// $BBP>]$N%m%1!<%k$K$*$1$k(B($B:GE,$J(B)$B;zKk%G!<%?$r<hF@$9$k$?$a$N(BURL$B$r@8@.$7$^$9!#(B
function GetCaptionDataUrl(){
  let element = document.getElementById(TARGET_ID);
  if(!element){ console.log("can not get element"); return; }
  let player_response = element.getAttribute(PLAYER_RESPONSE_ATTRIBUTE_NAME);
  if(!player_response){ console.log("can not get player_response", element); return; }
  let player_response_obj = JSON.parse(player_response);
  //console.log("player_response", player_response_obj);

  // $BMQ0U$5$l$F$$$k;zKk$G%?!<%2%C%H$H$J$k%m%1!<%k$NJ*$,$"$l$P$=$l$r;H$$$^$9(B
  let captionTracks = player_response_obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  let playLocaleCaptionBaseUrl = captionTracks.filter(obj => obj?.languageCode == playLocale)[0]?.baseUrl;
  if(playLocaleCaptionBaseUrl){
    return playLocaleCaptionBaseUrl + "&fmt=json3";
  }

  // $B$J$5$=$&$J$i!"(BcaptionTracks $B$N@hF,$NJ*$+$iBP>]$N%m%1!<%k$K=q$-49$($?J*$r<hF@$9$k$h$&$K$7$^$9!#(B
  let baseUrl = captionTracks[0]?.baseUrl;
  if(!baseUrl){ console.log("can not get baseUrl", player_response_obj); return; }
  let origUrl = baseUrl.replace(/,/g, "%2C");
  return origUrl + "&fmt=json3&xorb=2&xobt=3&xovt=3&tlang=" + playLocale;
}

function FetchCaptionData(){
  let url = GetCaptionDataUrl();
  fetch(url)
  .then((response)=>{
    return response.json();
  }).then((json)=>{
    captionData = CaptionDataToTimeDict(json);
    console.log("captionData update:", captionData);
  });
}

function FormatTimeFromMillisecond(millisecond){
  let totalSecond = millisecond / 1000;
  let hour = parseInt((totalSecond / 60 / 60) % 24);
  var minute = parseInt((totalSecond / 60) % 60);
  var second = parseInt((totalSecond) % 60);
  if(second < 10){ second = "0" + second; }
  if(hour > 0 && minute < 10){ minute = "0" + minute; }
  if(hour > 0){
    return hour + ":" + minute + ":" + second;
  }
  return minute + ":" + second;
}

// $B;zKk$N%G!<%?$r8e$G;H$$$d$9$$$h$&$K2C9)$7$F$*$-$^$9!#(B
function CaptionDataToTimeDict(captionData){
  let events = captionData?.events;
  if(!events){ console.log("CaptionDataToTimeDict(): error. events not found"); return; }
  let captionArray = events.map((obj)=>{
    let tStartMs = obj?.tStartMs;
    // $BI=<(>e$OJ,3d$7$FI=<($5$l$k$N$G$9$,!":GDc(B1$BJ8;z$E$D$GJ,3d$5$l$F$*$j(B
    // $B$=$N$^$^FI$_>e$2$k$H$V$D@Z$j$GJ9$/$K4.$($J$$;v$K$J$k$?$a!"(B
    // $B%;%0%a%s%H(B($BI=<(>e$O0l9TJ,$K$J$k$b$N(B)$B$K$D$$$F$O$R$H$+$?$^$j$K2C9)$7$F$*$-$^$9!#(B
    let segment = obj?.segs?.reduce((acc,current)=>{
      let text = current?.utf8;
      if(text){
        return acc + text;
      }
      return acc;
    }, '');
    return {"tStartMs": tStartMs, "segment": segment, "time": FormatTimeFromMillisecond(tStartMs)};
  }).filter((obj)=>{
    // $BH/OC$H$$$&0UL#$G$OCf?H$,6u$NJ*$O0UL#$,$J$$$N$G$3$3$G>C$7$F$*$-$^$9(B
    let segment = obj?.segment;
    if(segment?.length > 0 && segment.replace(/[\s\r\n]*/g, "").length > 0){
      return true;
    }
    return false;
  });
  var timeDict = {};
  captionArray.map(obj=>timeDict[obj.time]=obj);
  return timeDict;
}

function UpdatePlayLocale(locale){
  let l = locale?.replace(/-.*$/, '');
  if(l?.length > 0 && playLocale != l){
    playLocale = l;
    // locale $B$,JQ$o$C$F$$$?$J$i!":#FI$_9~$^$l$F$$$k;zKk%G!<%?$OGK4~$7$F?7$7$/FI$_D>$5$J$$$HFf$NH/OC$rB3$1$k;v$K$J$j$^$9!#(B
    captionData = {};
    UpdateCaptionData();
  }
}

function LoadVoiceSettings(){
  chrome.storage.sync.get(["lang", "voice", "pitch", "rate", "volume"], (result)=>{
    let lang = result.lang;
    let voiceName = result.voice;
    let voiceList = speechSynthesis.getVoices();
    for(voice of voiceList){
      if(voice.lang == lang && voice.name == voiceName){
        voiceVoice = voice;
        UpdatePlayLocale(lang);
      }
    }
    let pitch = result.pitch;
    if(pitch){
      voicePitch = pitch;
    }
    let rate = result.rate;
    if(rate){
      voiceRate = rate;
    }
    let volume = result.volume;
    if(volume){
      voiceVolume = volume;
    }
  });
}

function AddSpeechQueue(text){
  let utt = new SpeechSynthesisUtterance(text);
  if(voiceVoice){
    utt.voice = voiceVoice;
    utt.lang = utt.voice.lang;
  }
  utt.pitch = voicePitch;
  utt.rate = voiceRate;
  utt.volume = voiceVolume;
  utt.onerror = function(event){console.log("SpeechSynthesisUtterance Event onError", event);};
  speechSynthesis.speak(utt);
}

// $BC1=c$KICC10L$G;~4V$r3NG'$7$F!"A02sFI$_>e$2$?;~4V$HJQ$o$C$F$$$k$N$J$iH/OC$9$k!"$H$$$&;v$r$7$^$9!#(B
function CheckAndSpeech(currentTimeText){
  if(!currentTimeText){ console.log("currentTimeText is nil"); return;}
  if(currentTimeText == prevSpeakTime){ return;}
  let caption = captionData[currentTimeText];
  if(caption){
    prevSpeakTime = currentTimeText;
    AddSpeechQueue(caption.segment);
    return;
  }
  //console.log("no caption:", currentTimeText);
}

function IsValidVideoDuration(duration, captionData){
  var maxMillisecond = 0;
  for(let key in captionData){
    let tStartMs = captionData[key]?.tStartMs;
    if(tStartMs > maxMillisecond){
      maxMillisecond = tStartMs;
    }
  }
  return duration >= maxMillisecond / 1000;
}

// $B:F@80LCV$r(B video object $B$N(B .currentTime $B$+$i<hF@$7$^$9(B
function CheckVideoCurrentTime(){
  if(!isEnabled){return;}
  let videoElement = document.evaluate("//video[contains(@class,'html5-main-video')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)?.snapshotItem(0);
  if(!videoElement){return;}
  let currentTime = videoElement.currentTime;
  let duration = videoElement.duration;
  if(!IsValidVideoDuration(duration, captionData)){return;}
  let timeText = FormatTimeFromMillisecond(currentTime * 1000);
  CheckAndSpeech(timeText);
}

function UpdateCaptionData(){
  RemoveInjectElement(TARGET_ID);
  // Youtube$B$N(Bscript$B$,@_Dj$7$?%G!<%?$rFI$_<h$k$?$a$K(B body $B$K(B <script> $B$r;E9~$_$^$9(B
  InjectScript(INJECT_SCRIPT, TARGET_ID);
  // InjectScript() $B$G;E9~$^$l$?%G!<%?$r;H$C$F;zKk%G!<%?$r(B fetch $B$7$^$9(B
  FetchCaptionData();
}

function LoadIsEnabled(){
  chrome.storage.sync.get(["isEnabled"], (result)=>{
    if(result?.isEnabled){
      isEnabled = true;
    }else{
      isEnabled = false;
    }
  });
}
function UpdateIsEnabled(isEnabled){
  chrome.storage.sync.set({"isEnabled": isEnabled});
}

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse){
    //console.log("onMessage", message, sender, sendResponse);
    switch(message.type){
    case "KickSpeech":
      isEnabled = true;
      UpdateIsEnabled(isEnabled);
      LoadVoiceSettings();
      UpdateCaptionData();
      break;
    case "StopSpeech":
      isEnabled = false;
      UpdateIsEnabled(isEnabled);
      speechSynthesis.cancel();
      break;
    case "LoadIsEnabled":
      LoadIsEnabled();
      break;
    default:
      break;
    }
  }
);

LoadIsEnabled();
LoadVoiceSettings();
UpdateCaptionData();
// $B%S%G%*$N:F@80LCV$r(B 0.5$BIC4V3V(B $B$G3NG'$9$k$h$&$K$7$^$9(B
setInterval(CheckVideoCurrentTime, 500);
