#!/usr/bin/env python3
"""End-to-end React smoke test through browser_lab.html.

This test opens the static Browser Lab client in a host Playwright browser,
clicks the streamed canvas, types through the hidden text sink, and verifies
that the remote React page state changed. It complements react_smoke_test.py,
which talks directly to the sidecar WebSocket.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

import uvicorn
from playwright.async_api import async_playwright


HOST = "127.0.0.1"
PROXY_PORT = 9497
STATIC_PORT = 9582
FIXTURE_PORT = 9583
FRAME_PORT = 9585
PROFILE_DIR = Path("/tmp/tg-browser-lab-profile-react-client-smoke")
RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime-react-client-smoke")
FRAME_PATH = RUNTIME_DIR / "react_client_smoke_final.jpg"
UPLOAD_PATH = RUNTIME_DIR / "react_upload_fixture.txt"
DROP_PATH = RUNTIME_DIR / "react_drop_fixture.txt"
REPO_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = REPO_ROOT / "static_videochat"


FIXTURE_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React Client Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 18px; }
    label { display: block; margin: 6px 0; }
    input, textarea, select, button, [contenteditable] { font-size: 20px; padding: 8px; margin: 6px; }
    textarea { width: 360px; height: 70px; }
    input[type="checkbox"], input[type="radio"] { width: auto; }
    #pointerPad { width: 340px; height: 88px; margin: 8px 0; border: 2px solid #4277c4; display: grid; place-items: center; user-select: none; touch-action: none; }
    #drawCanvas { width: 300px; height: 120px; margin: 8px 0; border: 2px solid #375f64; display: block; touch-action: none; }
    #svgBoard { width: 320px; height: 120px; margin: 8px 0; border: 2px solid #576b91; touch-action: none; display: block; }
    #touchPad { width: 340px; height: 88px; margin: 8px 0; border: 2px solid #7a4d9b; display: grid; place-items: center; user-select: none; touch-action: none; }
    #multiTouchPad { width: 340px; height: 88px; margin: 8px 0; border: 2px solid #5d6f34; display: grid; place-items: center; user-select: none; touch-action: none; }
    #edgeDragPad { position: fixed; right: 0; top: 220px; width: 118px; height: 82px; border: 2px solid #8a3f61; background: #fff6fb; display: grid; place-items: center; user-select: none; touch-action: none; z-index: 5; }
    #capturePad { width: 170px; height: 74px; margin: 8px 0; border: 2px solid #2d8b9b; display: grid; place-items: center; user-select: none; touch-action: none; }
    #hoverPad { width: 340px; height: 70px; margin: 8px 0; border: 2px solid #9b6b2f; display: grid; place-items: center; user-select: none; }
    #pointerHoverPad { width: 340px; height: 70px; margin: 8px 0; border: 2px solid #7d7940; display: grid; place-items: center; user-select: none; }
    #pointerReorder { width: 240px; margin: 8px 0; border: 2px solid #5f5781; user-select: none; touch-action: none; }
    .reorderItem { height: 42px; display: grid; place-items: center; border-bottom: 1px solid #cfd0df; cursor: grab; }
    .reorderItem:last-child { border-bottom: 0; }
    #dragSource { width: 150px; height: 52px; margin: 8px 0; border: 2px solid #476f5d; display: grid; place-items: center; user-select: none; cursor: grab; }
    #dropZone { width: 240px; height: 74px; margin: 8px 0; border: 2px dashed #476f5d; display: grid; place-items: center; user-select: none; }
    #fileDropZone { width: 300px; height: 82px; margin: 8px 0; border: 2px dashed #346f82; display: grid; place-items: center; user-select: none; }
    #scrollBox { width: 360px; height: 92px; margin: 8px 0; overflow: auto; border: 2px solid #6b5ca5; }
    #scrollBox div { height: 36px; padding: 8px; box-sizing: border-box; border-bottom: 1px solid #ddd; }
    #virtualList { position: relative; width: 360px; height: 118px; margin: 8px 0; overflow: auto; border: 2px solid #676f42; }
    #virtualListInner { position: relative; height: 3400px; }
    .virtualRow { position: absolute; left: 0; right: 0; height: 34px; padding: 7px 10px; box-sizing: border-box; border-bottom: 1px solid #ddd; cursor: pointer; }
    #customSlider { width: 340px; height: 42px; margin: 8px 0; border: 2px solid #6f6042; display: grid; place-items: center; user-select: none; touch-action: none; }
    #pageScrollSpacer { height: 980px; display: grid; place-items: end start; color: #555; }
    #comboBox { position: relative; width: 390px; margin: 8px 0; }
    #comboList { width: 360px; margin: 0 6px; padding: 0; border: 2px solid #44637a; list-style: none; background: white; }
    #comboList li { padding: 10px; cursor: pointer; }
    #comboList li:hover { background: #e8f0fb; }
    #rovingMenuBlock { margin: 8px 0; }
    #rovingMenu { display: inline-grid; gap: 4px; margin-left: 8px; padding: 6px; border: 2px solid #466a54; }
    #rovingMenu button:focus { outline: 3px solid #2155b6; }
    #reactFrameClient { width: 560px; height: 180px; border: 2px solid #777; display: block; margin: 8px 0; }
    #shadowClientHost { display: block; margin: 8px 0; padding: 10px; border: 2px solid #8662b8; }
    #transformShell { height: 88px; margin: 8px 0; }
    #transformPanel { transform: translateX(36px) scale(1.25); transform-origin: top left; width: 210px; padding: 10px; border: 2px solid #7c4f62; }
    #portalRoot { margin-top: 10px; padding: 10px; border: 2px solid #398060; }
    #result { margin-top: 16px; font-size: 22px; font-weight: 700; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="root">loading react...</div>
  <div id="portalRoot"></div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script>
    const e = React.createElement;
    function App() {
      const reorderDragRef = React.useRef(null);
      const [name, setName] = React.useState('');
      const [alias, setAlias] = React.useState('');
      const [notes, setNotes] = React.useState('');
      const [spaceText, setSpaceText] = React.useState('');
      const [switchOn, setSwitchOn] = React.useState(false);
      const [switchSpaceCount, setSwitchSpaceCount] = React.useState(0);
      const [editBackspace, setEditBackspace] = React.useState('');
      const [editReplace, setEditReplace] = React.useState('');
      const [selectionReplace, setSelectionReplace] = React.useState('');
      const [selectionDelete, setSelectionDelete] = React.useState('');
      const [mouseSelectionReplace, setMouseSelectionReplace] = React.useState('');
      const [doubleSelectionReplace, setDoubleSelectionReplace] = React.useState('');
      const [editDelete, setEditDelete] = React.useState('');
      const [enterSubmitText, setEnterSubmitText] = React.useState('');
      const [enterSubmitCount, setEnterSubmitCount] = React.useState(0);
      const [ctrlEnterText, setCtrlEnterText] = React.useState('');
      const [ctrlEnterCount, setCtrlEnterCount] = React.useState(0);
      const [shiftEnterText, setShiftEnterText] = React.useState('');
      const [shiftEnterCount, setShiftEnterCount] = React.useState(0);
      const [focusBlurText, setFocusBlurText] = React.useState('');
      const [focusBlur, setFocusBlur] = React.useState({ focus: 0, blur: 0 });
      const [relatedFirstText, setRelatedFirstText] = React.useState('');
      const [relatedSecondText, setRelatedSecondText] = React.useState('');
      const [relatedBlurTarget, setRelatedBlurTarget] = React.useState('');
      const [relatedBlurCount, setRelatedBlurCount] = React.useState(0);
      const [debouncedText, setDebouncedText] = React.useState('');
      const [debouncedValue, setDebouncedValue] = React.useState('');
      const [validationText, setValidationText] = React.useState('');
      const [invalidCount, setInvalidCount] = React.useState(0);
      const [validationSubmitCount, setValidationSubmitCount] = React.useState(0);
      const [passwordText, setPasswordText] = React.useState('');
      const [numberText, setNumberText] = React.useState('');
      const [searchText, setSearchText] = React.useState('');
      const [searchSubmitCount, setSearchSubmitCount] = React.useState(0);
      const [labelText, setLabelText] = React.useState('');
      const [labelFocusCount, setLabelFocusCount] = React.useState(0);
      const [emailText, setEmailText] = React.useState('');
      const [emailBlurCount, setEmailBlurCount] = React.useState(0);
      const [telText, setTelText] = React.useState('');
      const [urlText, setUrlText] = React.useState('');
      const [dateText, setDateText] = React.useState('');
      const [timeText, setTimeText] = React.useState('');
      const [datetimeLocalText, setDatetimeLocalText] = React.useState('');
      const [monthText, setMonthText] = React.useState('');
      const [weekText, setWeekText] = React.useState('');
      const [colorText, setColorText] = React.useState('#000000');
      const [fileNames, setFileNames] = React.useState('');
      const [fileText, setFileText] = React.useState('');
      const [fileChangeCount, setFileChangeCount] = React.useState(0);
      const [dropFileName, setDropFileName] = React.useState('');
      const [dropFileText, setDropFileText] = React.useState('');
      const [dropFileCount, setDropFileCount] = React.useState(0);
      const [inputEventText, setInputEventText] = React.useState('');
      const [keyUpText, setKeyUpText] = React.useState('');
      const [keyUpCount, setKeyUpCount] = React.useState(0);
      const [inputTypeProbe, setInputTypeProbe] = React.useState('');
      const [inputTypeEvents, setInputTypeEvents] = React.useState([]);
      const [trustedText, setTrustedText] = React.useState('');
      const [trustedEvents, setTrustedEvents] = React.useState({ key: false, input: false, pointer: false, click: false });
      const [eventOrder, setEventOrder] = React.useState([]);
      const [beforeMaskText, setBeforeMaskText] = React.useState('');
      const [beforeMaskCount, setBeforeMaskCount] = React.useState(0);
      const [undoProbe, setUndoProbe] = React.useState('');
      const [undoVisitedEmpty, setUndoVisitedEmpty] = React.useState(false);
      const [resetProbe, setResetProbe] = React.useState('');
      const [resetCount, setResetCount] = React.useState(0);
      const [copyProbe, setCopyProbe] = React.useState('');
      const [copyCount, setCopyCount] = React.useState(0);
      const [cutProbe, setCutProbe] = React.useState('');
      const [cutCount, setCutCount] = React.useState(0);
      const [comboOpen, setComboOpen] = React.useState(false);
      const [comboQuery, setComboQuery] = React.useState('');
      const [comboChoice, setComboChoice] = React.useState('');
      const [comboMouseDowns, setComboMouseDowns] = React.useState(0);
      const [comboFocusKept, setComboFocusKept] = React.useState(false);
      const [keyboardComboOpen, setKeyboardComboOpen] = React.useState(false);
      const [keyboardComboQuery, setKeyboardComboQuery] = React.useState('');
      const [keyboardComboActive, setKeyboardComboActive] = React.useState(0);
      const [keyboardComboChoice, setKeyboardComboChoice] = React.useState('');
      const [rovingMenuOpen, setRovingMenuOpen] = React.useState(false);
      const [rovingMenuActive, setRovingMenuActive] = React.useState(0);
      const [rovingMenuChoice, setRovingMenuChoice] = React.useState('');
      const [rovingMenuFocus, setRovingMenuFocus] = React.useState(0);
      const [rovingMenuKeys, setRovingMenuKeys] = React.useState([]);
      const [captureText, setCaptureText] = React.useState('');
      const [captureEvents, setCaptureEvents] = React.useState({ keyDown: 0, pointerDown: 0, click: 0 });
      const [pasteProbe, setPasteProbe] = React.useState('');
      const [pasteShortcutProbe, setPasteShortcutProbe] = React.useState('');
      const [pasteShortcutCount, setPasteShortcutCount] = React.useState(0);
      const [pasteDataProbe, setPasteDataProbe] = React.useState('');
      const [pasteDataRead, setPasteDataRead] = React.useState('');
      const [pasteDataCount, setPasteDataCount] = React.useState(0);
      const [checked, setChecked] = React.useState(false);
      const [choice, setChoice] = React.useState('a');
      const [speed, setSpeed] = React.useState('slow');
      const [keyboardNativeChecked, setKeyboardNativeChecked] = React.useState(false);
      const [keyboardNativeRadio, setKeyboardNativeRadio] = React.useState('left');
      const [keyboardRangeValue, setKeyboardRangeValue] = React.useState('0');
      const [volume, setVolume] = React.useState('0');
      const [dragVolume, setDragVolume] = React.useState('0');
      const [portalText, setPortalText] = React.useState('');
      const [portalClicks, setPortalClicks] = React.useState(0);
      const [portalMenuOpen, setPortalMenuOpen] = React.useState(false);
      const [portalMenuChoice, setPortalMenuChoice] = React.useState('');
      const [portalMenuEscape, setPortalMenuEscape] = React.useState(0);
      const [portalMenuOutside, setPortalMenuOutside] = React.useState(0);
      const [portalMenuFocus, setPortalMenuFocus] = React.useState(0);
      const [portalTrapOpen, setPortalTrapOpen] = React.useState(false);
      const [portalTrapText, setPortalTrapText] = React.useState('');
      const [portalTrapFocusLog, setPortalTrapFocusLog] = React.useState([]);
      const [portalTrapTabs, setPortalTrapTabs] = React.useState(0);
      const [rich, setRich] = React.useState('');
      const [richClipboard, setRichClipboard] = React.useState('');
      const [richClipboardData, setRichClipboardData] = React.useState('');
      const [richPasteCount, setRichPasteCount] = React.useState(0);
      const [richCutCount, setRichCutCount] = React.useState(0);
      const [richIme, setRichIme] = React.useState('');
      const [richImeComposition, setRichImeComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const [richReplace, setRichReplace] = React.useState('');
      const [richMouseReplace, setRichMouseReplace] = React.useState('');
      const [richDoubleReplace, setRichDoubleReplace] = React.useState('');
      const [route, setRoute] = React.useState(window.location.pathname || '/');
      const [routeDetailSeen, setRouteDetailSeen] = React.useState(false);
      const [routeHomeReturned, setRouteHomeReturned] = React.useState(false);
      const [routeReplaceSeen, setRouteReplaceSeen] = React.useState(false);
      const [routeHashSeen, setRouteHashSeen] = React.useState(false);
      const [paletteOpen, setPaletteOpen] = React.useState(false);
      const [shortcutCount, setShortcutCount] = React.useState(0);
      const [codeShortcutCount, setCodeShortcutCount] = React.useState(0);
      const [escapeCount, setEscapeCount] = React.useState(0);
      const [pasteCount, setPasteCount] = React.useState(0);
      const [clicks, setClicks] = React.useState(0);
      const [shiftClicks, setShiftClicks] = React.useState(0);
      const [scaledClicks, setScaledClicks] = React.useState(0);
      const [transformClicks, setTransformClicks] = React.useState(0);
      const [doubleClicks, setDoubleClicks] = React.useState(0);
      const [contextMenus, setContextMenus] = React.useState(0);
      const [auxClicks, setAuxClicks] = React.useState(0);
      const [keyboardClicks, setKeyboardClicks] = React.useState(0);
      const [keyboardFocusCount, setKeyboardFocusCount] = React.useState(0);
      const [roleButtonClicks, setRoleButtonClicks] = React.useState(0);
      const [roleButtonKeys, setRoleButtonKeys] = React.useState([]);
      const [beforeInputCount, setBeforeInputCount] = React.useState(0);
      const [submitted, setSubmitted] = React.useState(false);
      const [canvasDraw, setCanvasDraw] = React.useState({ down: 0, move: 0, up: 0, startX: 0, startY: 0, lastX: 0, lastY: 0, maxDx: 0, maxDy: 0 });
      const [svgPointer, setSvgPointer] = React.useState({ down: 0, move: 0, up: 0, startX: 0, startY: 0, lastX: 0, lastY: 0, maxDx: 0, maxDy: 0 });
      const [pointer, setPointer] = React.useState({ down: 0, move: 0, up: 0, wheel: 0, startX: 0, totalDx: 0, wheelY: 0 });
      const [pointerButtonProbe, setPointerButtonProbe] = React.useState({ downButton: null, downButtons: 0, moveButtons: 0, upButton: null, upButtons: -1 });
      const [pointerMetaProbe, setPointerMetaProbe] = React.useState({ downId: null, moveId: null, upId: null, pointerType: '', isPrimary: false });
      const [touch, setTouch] = React.useState({ start: 0, move: 0, end: 0, startX: 0, totalDx: 0, endDx: 0, endChanged: 0 });
      const [multiTouch, setMultiTouch] = React.useState({ startMax: 0, moveMax: 0, endChangedMax: 0, startDistance: 0, moveDistance: 0, endDistance: 0 });
      const [edgeDrag, setEdgeDrag] = React.useState({ down: 0, move: 0, up: 0, maxX: 0, upX: 0 });
      const [pointerCapture, setPointerCapture] = React.useState({ down: 0, got: 0, move: 0, up: 0, lost: 0, startX: 0, maxDx: 0 });
      const [hover, setHover] = React.useState({ enter: 0, move: 0, leave: 0 });
      const [pointerHover, setPointerHover] = React.useState({ enter: 0, move: 0, leave: 0 });
      const [reorderItems, setReorderItems] = React.useState(['A', 'B', 'C']);
      const [reorderMoves, setReorderMoves] = React.useState(0);
      const [reorderDrops, setReorderDrops] = React.useState(0);
      const [dragDrop, setDragDrop] = React.useState({ start: 0, enter: 0, over: 0, drop: 0, end: 0, payload: '' });
      const [scrollTop, setScrollTop] = React.useState(0);
      const [virtualScrollTop, setVirtualScrollTop] = React.useState(0);
      const [virtualChoice, setVirtualChoice] = React.useState('');
      const [customSliderValue, setCustomSliderValue] = React.useState(0);
      const [customSliderPointerEvents, setCustomSliderPointerEvents] = React.useState(0);
      const [customSliderKeyEvents, setCustomSliderKeyEvents] = React.useState(0);
      const [pageScrollClicks, setPageScrollClicks] = React.useState(0);
      const [shadowText, setShadowText] = React.useState('');
      const [shadowPasteCount, setShadowPasteCount] = React.useState(0);
      const [shadowComposition, setShadowComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const [aliasComposition, setAliasComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const rovingMenuItems = ['New', 'Export', 'Archive'];
      const rovingMenuRefs = React.useRef([]);
      React.useEffect(() => {
        if (!rovingMenuOpen) return;
        const node = rovingMenuRefs.current[rovingMenuActive];
        if (node) node.focus();
      }, [rovingMenuOpen, rovingMenuActive]);
      const chooseRovingMenuItem = (item) => {
        setRovingMenuChoice(item);
        setRovingMenuOpen(false);
        setSubmitted(false);
      };
      const touchDistance = (touchList) => {
        const points = Array.from(touchList || []);
        if (points.length < 2) return 0;
        return Math.round(Math.hypot(points[1].clientX - points[0].clientX, points[1].clientY - points[0].clientY));
      };
      const handleRovingMenuKeyDown = (ev, item, index) => {
        setRovingMenuKeys((keys) => keys.concat(ev.key));
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          setRovingMenuActive((active) => (active + 1) % rovingMenuItems.length);
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          setRovingMenuActive((active) => (active + rovingMenuItems.length - 1) % rovingMenuItems.length);
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          setRovingMenuActive(0);
        } else if (ev.key === 'End') {
          ev.preventDefault();
          setRovingMenuActive(rovingMenuItems.length - 1);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          chooseRovingMenuItem(item);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          setRovingMenuOpen(false);
        }
      };
      const canvasDrawOk = canvasDraw.down >= 1 && canvasDraw.move >= 2 && canvasDraw.up >= 1 && canvasDraw.maxDx >= 80 && canvasDraw.lastX >= 230 && canvasDraw.lastY >= 70;
      const svgPointerOk = svgPointer.down >= 1 && svgPointer.move >= 2 && svgPointer.up >= 1 && svgPointer.maxDx >= 80 && svgPointer.lastX >= 220 && svgPointer.lastY >= 70;
      const pointerOk = pointer.down >= 1 && pointer.move >= 2 && pointer.up >= 1 && pointer.totalDx >= 80 && pointer.wheel >= 1 && pointer.wheelY >= 40;
      const pointerButtonOk = pointerButtonProbe.downButton === 0 && pointerButtonProbe.downButtons === 1 && pointerButtonProbe.moveButtons === 1 && pointerButtonProbe.upButton === 0 && pointerButtonProbe.upButtons === 0;
      const pointerMetaOk = pointerMetaProbe.pointerType === 'mouse' && pointerMetaProbe.isPrimary === true && pointerMetaProbe.downId != null && pointerMetaProbe.moveId === pointerMetaProbe.downId && pointerMetaProbe.upId === pointerMetaProbe.downId;
      const touchOk = touch.start >= 1 && touch.move >= 1 && touch.end >= 1 && touch.totalDx >= 60 && touch.endDx >= 60 && touch.endChanged >= 1;
      const multiTouchOk = multiTouch.startMax >= 2 && multiTouch.moveMax >= 2 && multiTouch.endChangedMax >= 2 && multiTouch.moveDistance >= multiTouch.startDistance + 30 && multiTouch.endDistance >= multiTouch.startDistance + 30;
      const edgeDragOk = edgeDrag.down >= 1 && edgeDrag.move >= 1 && edgeDrag.up >= 1 && edgeDrag.maxX >= window.innerWidth - 12 && edgeDrag.upX >= window.innerWidth - 12;
      const pointerCaptureOk = pointerCapture.down >= 1 && pointerCapture.got >= 1 && pointerCapture.move >= 2 && pointerCapture.lost >= 1 && pointerCapture.maxDx >= 80;
      const hoverOk = hover.enter >= 1 && hover.move >= 1 && hover.leave >= 1;
      const pointerHoverOk = pointerHover.enter >= 1 && pointerHover.move >= 1 && pointerHover.leave >= 1;
      const pointerReorderOk = reorderItems.join('') === 'BAC' && reorderMoves >= 1 && reorderDrops >= 1;
      const compositionOk = aliasComposition.start >= 1 && aliasComposition.update >= 1 && aliasComposition.end >= 1;
      const pasteOk = pasteProbe === 'clip' && pasteCount === 1;
      const pasteShortcutOk = pasteShortcutProbe === 'abcXYZ' && pasteShortcutCount === 1;
      const pasteDataOk = pasteDataProbe === 'clipdata' && pasteDataRead === 'clipdata' && pasteDataCount === 1;
      const modifierOk = shiftClicks === 1;
      const clickGestureOk = doubleClicks === 1 && contextMenus === 1 && auxClicks === 1;
      const keyboardOk = keyboardClicks === 2 && keyboardFocusCount >= 1;
      const roleButtonOk = roleButtonClicks === 3 && roleButtonKeys.includes('Enter') && roleButtonKeys.includes(' ');
      const rangeOk = Number(volume) >= 80;
      const dragRangeOk = Number(dragVolume) >= 80;
      const portalOk = portalText === 'portal' && portalClicks === 1;
      const portalMenuOk = portalMenuChoice === 'Save' && portalMenuEscape === 1 && portalMenuOutside === 1 && portalMenuFocus >= 3 && !portalMenuOpen;
      const portalTrapOk = portalTrapText === 'trap'
        && portalTrapTabs >= 2
        && portalTrapFocusLog.includes('first')
        && portalTrapFocusLog.includes('second')
        && portalTrapOpen;
      const beforeInputOk = beforeInputCount >= 1;
      const spaceOk = spaceText === 'hello world' && switchOn && switchSpaceCount === 1;
      const editOk = editBackspace === 'keep' && editReplace === 'done' && editDelete === 'del';
      const enterSubmitOk = enterSubmitText === 'enter' && enterSubmitCount === 1;
      const ctrlEnterOk = ctrlEnterText === 'send' && ctrlEnterCount === 1;
      const shiftEnterOk = shiftEnterText === 'soft\\nline' && shiftEnterCount === 1;
      const focusBlurOk = focusBlurText === 'focus' && focusBlur.focus >= 1 && focusBlur.blur >= 1;
      const relatedBlurOk = relatedFirstText === 'rel' && relatedSecondText === 'target' && relatedBlurTarget === 'relatedSecond' && relatedBlurCount === 1;
      const debounceOk = debouncedText === 'query' && debouncedValue === 'query';
      const validationOk = validationText === 'valid' && invalidCount === 1 && validationSubmitCount === 1;
      const specialInputOk = passwordText === 'secret' && numberText === '42' && searchText === 'find' && searchSubmitCount === 1 && labelText === 'label' && labelFocusCount >= 1;
      const contactInputOk = emailText === 'user@example.test' && emailBlurCount >= 1 && telText === '5550100' && urlText === 'https://example.test';
      const dateTimeOk = dateText === '2026-05-02' && timeText === '13:45' && datetimeLocalText === '2026-05-02T13:45' && monthText === '2026-05' && weekText === '2026-W18' && colorText === '#336699';
      const fileInputOk = fileNames === 'react_upload_fixture.txt' && fileText === 'react upload fixture' && fileChangeCount === 1;
      const fileDropOk = dropFileName === 'react_drop_fixture.txt' && dropFileText === 'react drop fixture' && dropFileCount === 1;
      const inputEventOk = inputEventText === 'input';
      const keyUpOk = keyUpText === 'keyup' && keyUpCount >= 5;
      const inputTypeOk = inputTypeProbe === 'aXY'
        && inputTypeEvents.includes('input:insertText:a')
        && inputTypeEvents.includes('input:insertText:b')
        && inputTypeEvents.some((item) => item.startsWith('input:deleteContentBackward:'))
        && inputTypeEvents.includes('input:insertFromPaste:XY');
      const trustedOk = trustedText === 't' && trustedEvents.key && trustedEvents.input && trustedEvents.pointer && trustedEvents.click;
      const eventOrderOk = ['pointerdown', 'mousedown', 'focus', 'pointerup', 'mouseup', 'click'].every((name) => eventOrder.includes(name))
        && eventOrder.indexOf('pointerdown') < eventOrder.indexOf('mousedown')
        && eventOrder.indexOf('mousedown') < eventOrder.indexOf('pointerup')
        && eventOrder.indexOf('pointerup') < eventOrder.indexOf('mouseup')
        && eventOrder.indexOf('mouseup') < eventOrder.indexOf('click')
        && eventOrder.indexOf('focus') < eventOrder.indexOf('click');
      const beforeMaskOk = beforeMaskText === 'MASK' && beforeMaskCount >= 4;
      const undoOk = undoProbe === 'undo' && undoVisitedEmpty;
      const resetOk = resetProbe === '' && resetCount === 1;
      const selectionReplaceOk = selectionReplace === 'abcXYZ';
      const selectionDeleteOk = selectionDelete === 'abc';
      const mouseSelectionReplaceOk = mouseSelectionReplace === 'mouse';
      const doubleSelectionReplaceOk = doubleSelectionReplace === 'hello there';
      const copyOk = copyProbe === 'copyme' && copyCount >= 1;
      const partialCopyOk = copyProbe === 'copyme' && copyCount >= 2;
      const cutOk = cutProbe === '' && cutCount === 1;
      const comboOk = comboQuery === 'be' && comboChoice === 'Beta' && comboMouseDowns === 1 && comboFocusKept && !comboOpen;
      const keyboardComboOptions = ['Alpha', 'Beta', 'Gamma'].filter((item) => item.toLowerCase().includes(keyboardComboQuery.toLowerCase()));
      const keyboardComboOk = keyboardComboQuery === 'a' && keyboardComboChoice === 'Beta' && !keyboardComboOpen;
      const rovingMenuOk = rovingMenuChoice === 'Export' && rovingMenuFocus >= 3 && !rovingMenuOpen && ['ArrowDown', 'End', 'ArrowUp', 'Enter'].every((key) => rovingMenuKeys.includes(key));
      const captureOk = captureText === 'cap' && captureEvents.keyDown >= 3 && captureEvents.pointerDown === 1 && captureEvents.click === 1;
      const controlsOk = checked && choice === 'b' && speed === 'fast' && rich === 'notes';
      const keyboardNativeOk = keyboardNativeChecked && keyboardNativeRadio === 'right';
      const keyboardRangeOk = Number(keyboardRangeValue) >= 90;
      const richClipboardOk = richClipboard === '' && richClipboardData === 'richclip' && richPasteCount === 1 && richCutCount === 1;
      const richImeOk = richIme === '\\uD55C\\uAE00' && richImeComposition.start >= 1 && richImeComposition.update >= 1 && richImeComposition.end >= 1;
      const richReplaceOk = richReplace === 'abcXYZ';
      const richMouseReplaceOk = richMouseReplace.endsWith('mouse') && richMouseReplace.length < 'dragselectmouse'.length;
      const richDoubleReplaceOk = richDoubleReplace === 'hello there';
      const routeOk = route === '/' && routeDetailSeen && routeHomeReturned && routeReplaceSeen && routeHashSeen;
      const shortcutOk = !paletteOpen && shortcutCount === 1 && escapeCount === 1;
      const codeShortcutOk = codeShortcutCount === 1;
      const dragDropOk = dragDrop.start >= 1 && dragDrop.enter >= 1 && dragDrop.over >= 1 && dragDrop.drop === 1 && dragDrop.end >= 1 && dragDrop.payload === 'card';
      const scrollOk = scrollTop >= 80;
      const virtualStart = Math.max(0, Math.min(92, Math.floor(virtualScrollTop / 34) - 2));
      const virtualRows = Array.from({ length: 10 }, (_, index) => virtualStart + index).filter((index) => index < 100);
      const virtualListOk = virtualChoice === 'Row 42' && virtualScrollTop >= 1000;
      const customSliderOk = customSliderValue === 100 && customSliderPointerEvents >= 1 && customSliderKeyEvents >= 2;
      const pageScrollOk = pageScrollClicks === 1;
      const shadowCompositionOk = shadowComposition.start >= 1 && shadowComposition.update >= 1 && shadowComposition.end >= 1;
      const shadowOk = shadowText === 'shadow\\uD55C\\uAE00clip' && shadowPasteCount === 1 && shadowCompositionOk;
      const scaledOk = scaledClicks === 1;
      const transformOk = transformClicks === 1;
      const ok = name === 'react' && alias === '\\uD55C\\uAE00' && compositionOk && notes === 'multi\\nline' && spaceOk && editOk && selectionReplaceOk && selectionDeleteOk && mouseSelectionReplaceOk && doubleSelectionReplaceOk && enterSubmitOk && ctrlEnterOk && shiftEnterOk && focusBlurOk && relatedBlurOk && debounceOk && validationOk && specialInputOk && contactInputOk && dateTimeOk && fileInputOk && fileDropOk && inputEventOk && keyUpOk && inputTypeOk && trustedOk && eventOrderOk && beforeMaskOk && undoOk && resetOk && copyOk && partialCopyOk && cutOk && comboOk && keyboardComboOk && rovingMenuOk && captureOk && pasteOk && pasteShortcutOk && pasteDataOk && beforeInputOk && controlsOk && keyboardNativeOk && keyboardRangeOk && richClipboardOk && richImeOk && richReplaceOk && richMouseReplaceOk && richDoubleReplaceOk && routeOk && shortcutOk && codeShortcutOk && rangeOk && dragRangeOk && portalOk && portalMenuOk && portalTrapOk && canvasDrawOk && svgPointerOk && pointerOk && pointerButtonOk && pointerMetaOk && touchOk && multiTouchOk && edgeDragOk && pointerCaptureOk && hoverOk && pointerHoverOk && pointerReorderOk && dragDropOk && scrollOk && virtualListOk && customSliderOk && pageScrollOk && shadowOk && scaledOk && transformOk && modifierOk && clickGestureOk && keyboardOk && roleButtonOk && clicks === 1;
      const state = { name, alias, aliasComposition, compositionOk, notes, spaceText, switchOn, switchSpaceCount, spaceOk, editBackspace, editReplace, selectionReplace, selectionReplaceOk, selectionDelete, selectionDeleteOk, mouseSelectionReplace, mouseSelectionReplaceOk, doubleSelectionReplace, doubleSelectionReplaceOk, editDelete, editOk, enterSubmitText, enterSubmitCount, enterSubmitOk, ctrlEnterText, ctrlEnterCount, ctrlEnterOk, shiftEnterText, shiftEnterCount, shiftEnterOk, focusBlurText, focusBlur, focusBlurOk, relatedFirstText, relatedSecondText, relatedBlurTarget, relatedBlurCount, relatedBlurOk, debouncedText, debouncedValue, debounceOk, validationText, invalidCount, validationSubmitCount, validationOk, passwordText, numberText, searchText, searchSubmitCount, labelText, labelFocusCount, specialInputOk, emailText, emailBlurCount, telText, urlText, contactInputOk, dateText, timeText, datetimeLocalText, monthText, weekText, colorText, dateTimeOk, fileNames, fileText, fileChangeCount, fileInputOk, dropFileName, dropFileText, dropFileCount, fileDropOk, inputEventText, inputEventOk, keyUpText, keyUpCount, keyUpOk, inputTypeProbe, inputTypeEvents, inputTypeOk, trustedText, trustedEvents, trustedOk, eventOrder, eventOrderOk, beforeMaskText, beforeMaskCount, beforeMaskOk, undoProbe, undoVisitedEmpty, undoOk, resetProbe, resetCount, resetOk, copyProbe, copyCount, copyOk, partialCopyOk, cutProbe, cutCount, cutOk, comboOpen, comboQuery, comboChoice, comboMouseDowns, comboFocusKept, comboOk, keyboardComboOpen, keyboardComboQuery, keyboardComboActive, keyboardComboChoice, keyboardComboOk, rovingMenuOpen, rovingMenuActive, rovingMenuChoice, rovingMenuFocus, rovingMenuKeys, rovingMenuOk, captureText, captureEvents, captureOk, pasteProbe, pasteShortcutProbe, pasteShortcutCount, pasteShortcutOk, pasteDataProbe, pasteDataRead, pasteDataCount, pasteDataOk, checked, choice, speed, rich, controlsOk, keyboardNativeChecked, keyboardNativeRadio, keyboardNativeOk, keyboardRangeValue, keyboardRangeOk, richClipboard, richClipboardData, richPasteCount, richCutCount, richClipboardOk, richIme, richImeComposition, richImeOk, richReplace, richReplaceOk, richMouseReplace, richMouseReplaceOk, richDoubleReplace, richDoubleReplaceOk, route, routeDetailSeen, routeHomeReturned, routeReplaceSeen, routeHashSeen, routeOk, paletteOpen, shortcutCount, codeShortcutCount, codeShortcutOk, escapeCount, shortcutOk, volume, rangeOk, dragVolume, dragRangeOk, portalText, portalClicks, portalOk, portalMenuOpen, portalMenuChoice, portalMenuEscape, portalMenuOutside, portalMenuFocus, portalMenuOk, portalTrapOpen, portalTrapText, portalTrapFocusLog, portalTrapTabs, portalTrapOk, pasteCount, pasteOk, beforeInputCount, beforeInputOk, canvasDraw, canvasDrawOk, svgPointer, svgPointerOk, pointer, pointerOk, pointerButtonProbe, pointerButtonOk, pointerMetaProbe, pointerMetaOk, touch, touchOk, multiTouch, multiTouchOk, edgeDrag, edgeDragOk, pointerCapture, pointerCaptureOk, hover, hoverOk, pointerHover, pointerHoverOk, reorderItems, reorderMoves, reorderDrops, pointerReorderOk, dragDrop, dragDropOk, scrollTop, scrollOk, virtualScrollTop, virtualChoice, virtualListOk, customSliderValue, customSliderPointerEvents, customSliderKeyEvents, customSliderOk, pageScrollClicks, pageScrollOk, shadowText, shadowPasteCount, shadowComposition, shadowCompositionOk, shadowOk, clicks, scaledClicks, scaledOk, transformClicks, transformOk, shiftClicks, modifierOk, doubleClicks, contextMenus, auxClicks, clickGestureOk, keyboardClicks, keyboardFocusCount, keyboardOk, roleButtonClicks, roleButtonKeys, roleButtonOk, submitted, ok };
      window.__browserLabClientSmokeState = state;
      function ShadowApp() {
        return e('div', null,
          e('label', null, 'Shadow Input ',
            e('input', {
              id: 'shadowClientInput',
              value: shadowText,
              onCompositionStart: () => setShadowComposition((prev) => ({ ...prev, start: prev.start + 1 })),
              onCompositionUpdate: () => setShadowComposition((prev) => ({ ...prev, update: prev.update + 1 })),
              onCompositionEnd: () => setShadowComposition((prev) => ({ ...prev, end: prev.end + 1 })),
              onPaste: () => setShadowPasteCount((count) => count + 1),
              onChange: (ev) => { setShadowText(ev.target.value); setSubmitted(false); }
            })
          ),
          e('div', { id: 'shadowClientResult' }, shadowOk ? 'ok:shadow:' + shadowText : 'state:shadow:' + shadowText + ':' + shadowPasteCount)
        );
      }
      if (!customElements.get('browser-lab-client-shadow')) {
        customElements.define('browser-lab-client-shadow', class extends HTMLElement {
          connectedCallback() {
            if (this.shadowRoot) return;
            const root = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = 'input { font-size: 20px; padding: 8px; width: 340px; } #shadowClientResult { margin-top: 8px; font-weight: 700; }';
            const mount = document.createElement('div');
            root.append(style, mount);
            ReactDOM.createRoot(mount).render(e(ShadowApp));
          }
        });
      }
      React.useEffect(() => {
        const syncRoute = () => {
          const nextRoute = window.location.pathname || '/';
          setRoute(nextRoute);
          if (nextRoute === '/') setRouteHomeReturned(true);
        };
        window.addEventListener('popstate', syncRoute);
        return () => window.removeEventListener('popstate', syncRoute);
      }, []);
      React.useEffect(() => {
        document.title = 'Browser Lab React Client Smoke ' + route;
      }, [route]);
      React.useEffect(() => {
        const onKeyDown = (ev) => {
          if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
            ev.preventDefault();
            setPaletteOpen(true);
            setShortcutCount((count) => count + 1);
            setSubmitted(false);
          }
          if (ev.ctrlKey && ev.altKey && ev.code === 'KeyL' && ev.keyCode === 76 && ev.which === 76) {
            ev.preventDefault();
            setCodeShortcutCount((count) => count + 1);
            setSubmitted(false);
          }
          if (ev.key === 'Escape' && paletteOpen) {
            ev.preventDefault();
            setPaletteOpen(false);
            setEscapeCount((count) => count + 1);
            setSubmitted(false);
          }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [paletteOpen]);
      React.useEffect(() => {
        const timer = window.setTimeout(() => {
          setDebouncedValue(debouncedText);
        }, 180);
        return () => window.clearTimeout(timer);
      }, [debouncedText]);
      React.useEffect(() => {
        if (!portalMenuOpen) return undefined;
        const focusTimer = window.setTimeout(() => {
          const firstItem = document.getElementById('portalMenuItemSave');
          if (firstItem) firstItem.focus();
        }, 0);
        const onKeyDown = (ev) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            setPortalMenuOpen(false);
            setPortalMenuEscape((count) => count + 1);
            setSubmitted(false);
          }
        };
        const onPointerDown = (ev) => {
          const target = ev.target;
          if (
            target &&
            target.closest &&
            !target.closest('#portalMenuPanel') &&
            !target.closest('#portalMenuTrigger')
          ) {
            setPortalMenuOpen(false);
            setPortalMenuOutside((count) => count + 1);
            setSubmitted(false);
          }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        return () => {
          window.clearTimeout(focusTimer);
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('pointerdown', onPointerDown);
        };
      }, [portalMenuOpen]);
      React.useEffect(() => {
        if (!portalTrapOpen) return;
        const timer = window.setTimeout(() => {
          const first = document.getElementById('portalTrapFirst');
          if (first) first.focus();
        }, 0);
        return () => window.clearTimeout(timer);
      }, [portalTrapOpen]);
      const handlePortalTrapKeyDown = (ev) => {
        if (ev.key !== 'Tab') return;
        ev.preventDefault();
        const ids = ['portalTrapFirst', 'portalTrapSecond'];
        const currentIndex = Math.max(0, ids.indexOf(document.activeElement && document.activeElement.id));
        const nextIndex = ev.shiftKey
          ? (currentIndex + ids.length - 1) % ids.length
          : (currentIndex + 1) % ids.length;
        const next = document.getElementById(ids[nextIndex]);
        if (next) next.focus();
        setPortalTrapTabs((count) => count + 1);
        setSubmitted(false);
      };
      const openDetail = (ev) => {
        ev.preventDefault();
        window.history.pushState({ screen: 'detail' }, '', '/spa/detail?from=client#section');
        setRoute('/spa/detail');
        setRouteDetailSeen(true);
        setSubmitted(false);
      };
      const replaceRoute = (ev) => {
        ev.preventDefault();
        window.history.replaceState({ screen: 'replace' }, '', '/?replace=done');
        setRoute('/');
        setRouteReplaceSeen(true);
        setSubmitted(false);
      };
      const setHashRoute = (ev) => {
        ev.preventDefault();
        window.location.hash = 'hash-route';
        setRouteHashSeen(true);
        setSubmitted(false);
      };
      return e('form', {
        onSubmit: (ev) => {
          ev.preventDefault();
          const submitter = ev.nativeEvent && ev.nativeEvent.submitter;
          if (document.activeElement && document.activeElement.id === 'enterSubmit') {
            setEnterSubmitCount((count) => count + 1);
          }
          if (submitter && submitter.id === 'validationSubmitButton') {
            setValidationSubmitCount((count) => count + 1);
          }
          setSubmitted(true);
        },
        onReset: () => {
          setResetProbe('');
          setResetCount((count) => count + 1);
          setSubmitted(false);
        }
      },
        e('h1', null, 'Browser Lab React Client Smoke'),
        e('nav', { id: 'spaNav' },
          e('a', { id: 'spaDetailLink', href: '/spa/detail?from=client#section', onClick: openDetail }, 'Detail route'),
          e('a', { id: 'spaReplaceLink', href: '/?replace=done', onClick: replaceRoute }, 'Replace route'),
          e('a', { id: 'spaHashLink', href: '#hash-route', onClick: setHashRoute }, 'Hash route'),
          e('span', { id: 'routeState' }, routeOk ? 'ok:spa' : 'state:spa:' + route + ':' + routeDetailSeen + ':' + routeHomeReturned + ':' + routeReplaceSeen + ':' + routeHashSeen)
        ),
        e('div', { id: 'shortcutState' }, shortcutOk ? 'ok:shortcut' : 'state:shortcut:' + paletteOpen + ':' + shortcutCount + ':' + escapeCount),
        e('label', null, 'Name',
          e('input', {
            id: 'name',
            value: name,
            onBeforeInput: () => { setBeforeInputCount((count) => count + 1); },
            onChange: (ev) => { setName(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Alias',
          e('input', {
            id: 'alias',
            value: alias,
            onCompositionStart: () => { setAliasComposition((prev) => ({ ...prev, start: prev.start + 1 })); },
            onCompositionUpdate: () => { setAliasComposition((prev) => ({ ...prev, update: prev.update + 1 })); },
            onCompositionEnd: () => { setAliasComposition((prev) => ({ ...prev, end: prev.end + 1 })); },
            onChange: (ev) => { setAlias(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Notes',
          e('textarea', {
            id: 'notes',
            value: notes,
            onChange: (ev) => { setNotes(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Space Text',
          e('input', {
            id: 'spaceText',
            value: spaceText,
            onChange: (ev) => { setSpaceText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', {
          id: 'spaceSwitch',
          role: 'switch',
          tabIndex: 0,
          'aria-checked': switchOn ? 'true' : 'false',
          onKeyDown: (ev) => {
            if (ev.key === ' ') {
              ev.preventDefault();
              setSwitchOn((value) => !value);
              setSwitchSpaceCount((count) => count + 1);
              setSubmitted(false);
            }
          }
        }, switchOn ? 'Switch on' : 'Switch off'),
        e('label', null, 'Backspace',
          e('input', {
            id: 'editBackspace',
            value: editBackspace,
            onChange: (ev) => { setEditBackspace(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Replace',
          e('input', {
            id: 'editReplace',
            value: editReplace,
            onChange: (ev) => { setEditReplace(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Partial Replace',
          e('input', {
            id: 'selectionReplace',
            value: selectionReplace,
            onChange: (ev) => { setSelectionReplace(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Partial Delete',
          e('input', {
            id: 'selectionDelete',
            value: selectionDelete,
            onChange: (ev) => { setSelectionDelete(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Mouse Selection Replace',
          e('input', {
            id: 'mouseSelectionReplace',
            value: mouseSelectionReplace,
            onChange: (ev) => { setMouseSelectionReplace(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Double Selection Replace',
          e('input', {
            id: 'doubleSelectionReplace',
            value: doubleSelectionReplace,
            onChange: (ev) => { setDoubleSelectionReplace(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Delete',
          e('input', {
            id: 'editDelete',
            value: editDelete,
            onChange: (ev) => { setEditDelete(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Enter Submit',
          e('input', {
            id: 'enterSubmit',
            value: enterSubmitText,
            onChange: (ev) => { setEnterSubmitText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('button', { id: 'enterSubmitButton', type: 'submit', formNoValidate: true }, 'Enter Submit Action'),
        e('label', null, 'Ctrl Enter',
          e('textarea', {
            id: 'ctrlEnter',
            value: ctrlEnterText,
            onKeyDown: (ev) => {
              if (ev.ctrlKey && ev.key === 'Enter') {
                ev.preventDefault();
                setCtrlEnterCount((count) => count + 1);
                setSubmitted(false);
              }
            },
            onChange: (ev) => { setCtrlEnterText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Shift Enter',
          e('textarea', {
            id: 'shiftEnter',
            value: shiftEnterText,
            onKeyDown: (ev) => {
              if (ev.shiftKey && ev.key === 'Enter') {
                setShiftEnterCount((count) => count + 1);
                setSubmitted(false);
              }
            },
            onChange: (ev) => { setShiftEnterText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Focus Blur',
          e('input', {
            id: 'focusBlur',
            value: focusBlurText,
            onFocus: () => { setFocusBlur((prev) => ({ ...prev, focus: prev.focus + 1 })); },
            onBlur: () => { setFocusBlur((prev) => ({ ...prev, blur: prev.blur + 1 })); },
            onChange: (ev) => { setFocusBlurText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { id: 'relatedBlurGroup' },
          e('label', null, 'Related First',
            e('input', {
              id: 'relatedFirst',
              value: relatedFirstText,
              onBlur: (ev) => {
                setRelatedBlurTarget(ev.relatedTarget && ev.relatedTarget.id || '');
                setRelatedBlurCount((count) => count + 1);
                setSubmitted(false);
              },
              onChange: (ev) => { setRelatedFirstText(ev.target.value); setSubmitted(false); }
            })
          ),
          e('label', null, 'Related Second',
            e('input', {
              id: 'relatedSecond',
              value: relatedSecondText,
              onChange: (ev) => { setRelatedSecondText(ev.target.value); setSubmitted(false); }
            })
          )
        ),
        e('label', null, 'Debounced',
          e('input', {
            id: 'debounced',
            value: debouncedText,
            onChange: (ev) => { setDebouncedText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Validation',
          e('input', {
            id: 'validationProbe',
            required: true,
            value: validationText,
            onInvalid: (ev) => {
              ev.preventDefault();
              setInvalidCount((count) => count + 1);
              setSubmitted(false);
            },
            onChange: (ev) => { setValidationText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('button', { id: 'validationSubmitButton', type: 'submit' }, 'Validation Submit'),
        e('label', null, 'Password',
          e('input', {
            id: 'passwordProbe',
            type: 'password',
            autoComplete: 'current-password',
            value: passwordText,
            onChange: (ev) => { setPasswordText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Number',
          e('input', {
            id: 'numberProbe',
            type: 'number',
            inputMode: 'numeric',
            value: numberText,
            onChange: (ev) => { setNumberText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Search',
          e('input', {
            id: 'searchProbe',
            type: 'search',
            value: searchText,
            onChange: (ev) => { setSearchText(ev.target.value); setSubmitted(false); },
            onKeyDown: (ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                setSearchSubmitCount((count) => count + 1);
                setSubmitted(false);
              }
            }
          })
        ),
        e('label', { id: 'labelFocusLabel', htmlFor: 'labelFocusTarget' }, 'Label Focus'),
        e('input', {
          id: 'labelFocusTarget',
          value: labelText,
          onFocus: () => { setLabelFocusCount((count) => count + 1); },
          onChange: (ev) => { setLabelText(ev.target.value); setSubmitted(false); }
        }),
        e('label', null, 'Email',
          e('input', {
            id: 'emailProbe',
            type: 'email',
            autoComplete: 'email',
            value: emailText,
            onBlur: () => { setEmailBlurCount((count) => count + 1); },
            onChange: (ev) => { setEmailText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Tel',
          e('input', {
            id: 'telProbe',
            type: 'tel',
            autoComplete: 'tel',
            value: telText,
            onChange: (ev) => { setTelText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'URL',
          e('input', {
            id: 'urlProbe',
            type: 'url',
            value: urlText,
            onChange: (ev) => { setUrlText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Date',
          e('input', {
            id: 'dateProbe',
            type: 'date',
            value: dateText,
            onChange: (ev) => { setDateText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Time',
          e('input', {
            id: 'timeProbe',
            type: 'time',
            value: timeText,
            onChange: (ev) => { setTimeText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Datetime Local',
          e('input', {
            id: 'datetimeLocalProbe',
            type: 'datetime-local',
            value: datetimeLocalText,
            onChange: (ev) => { setDatetimeLocalText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Month',
          e('input', {
            id: 'monthProbe',
            type: 'month',
            value: monthText,
            onChange: (ev) => { setMonthText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Week',
          e('input', {
            id: 'weekProbe',
            type: 'week',
            value: weekText,
            onChange: (ev) => { setWeekText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Color',
          e('input', {
            id: 'colorProbe',
            type: 'color',
            value: colorText,
            onChange: (ev) => { setColorText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'File',
          e('input', {
            id: 'fileProbe',
            type: 'file',
            onChange: async (ev) => {
              const files = Array.from(ev.target.files || []);
              setFileNames(files.map((file) => file.name).join(','));
              setFileText(files[0] ? await files[0].text() : '');
              setFileChangeCount((count) => count + 1);
              setSubmitted(false);
            }
          })
        ),
        e('div', {
          id: 'fileDropZone',
          onDragOver: (ev) => {
            ev.preventDefault();
            setSubmitted(false);
          },
          onDrop: async (ev) => {
            ev.preventDefault();
            const files = Array.from(ev.dataTransfer.files || []);
            setDropFileName(files[0] ? files[0].name : '');
            setDropFileText(files[0] ? await files[0].text() : '');
            setDropFileCount((count) => count + 1);
            setSubmitted(false);
          }
        }, fileDropOk ? 'Dropped file' : 'Drop file here'),
        e('label', null, 'Input Event',
          e('input', {
            id: 'inputEvent',
            value: inputEventText,
            onInput: (ev) => { setInputEventText(ev.currentTarget.value); setSubmitted(false); },
            onChange: () => {}
          })
        ),
        e('label', null, 'Key Up',
          e('input', {
            id: 'keyUpProbe',
            value: keyUpText,
            onChange: (ev) => { setKeyUpText(ev.target.value); setSubmitted(false); },
            onKeyUp: () => { setKeyUpCount((count) => count + 1); setSubmitted(false); }
          })
        ),
        e('label', null, 'Input Type',
          e('input', {
            id: 'inputTypeProbe',
            value: inputTypeProbe,
            onInput: (ev) => {
              const native = ev.nativeEvent || {};
              const data = native.data == null ? '' : native.data;
              setInputTypeEvents((events) => events.concat('input:' + (native.inputType || '') + ':' + data));
              setInputTypeProbe(ev.currentTarget.value);
              setSubmitted(false);
            },
            onChange: () => {}
          })
        ),
        e('label', null, 'Trusted Input',
          e('input', {
            id: 'trustedInput',
            value: trustedText,
            onKeyDown: (ev) => {
              if (ev.nativeEvent && ev.nativeEvent.isTrusted) {
                setTrustedEvents((prev) => ({ ...prev, key: true }));
              }
              setSubmitted(false);
            },
            onInput: (ev) => {
              if (ev.nativeEvent && ev.nativeEvent.isTrusted) {
                setTrustedEvents((prev) => ({ ...prev, input: true }));
              }
              setTrustedText(ev.currentTarget.value);
              setSubmitted(false);
            },
            onChange: () => {}
          })
        ),
        e('button', {
          id: 'trustedButton',
          type: 'button',
          onPointerDown: (ev) => {
            if (ev.nativeEvent && ev.nativeEvent.isTrusted) {
              setTrustedEvents((prev) => ({ ...prev, pointer: true }));
            }
            setSubmitted(false);
          },
          onClick: (ev) => {
            if (ev.nativeEvent && ev.nativeEvent.isTrusted) {
              setTrustedEvents((prev) => ({ ...prev, click: true }));
            }
            setSubmitted(false);
          }
        }, 'Trusted Button'),
        e('button', {
          id: 'eventOrderButton',
          type: 'button',
          onPointerDown: () => { setEventOrder((log) => log.concat('pointerdown')); setSubmitted(false); },
          onMouseDown: () => { setEventOrder((log) => log.concat('mousedown')); setSubmitted(false); },
          onFocus: () => { setEventOrder((log) => log.concat('focus')); setSubmitted(false); },
          onPointerUp: () => { setEventOrder((log) => log.concat('pointerup')); setSubmitted(false); },
          onMouseUp: () => { setEventOrder((log) => log.concat('mouseup')); setSubmitted(false); },
          onClick: () => { setEventOrder((log) => log.concat('click')); setSubmitted(false); }
        }, 'Event Order Button'),
        e('label', null, 'BeforeInput Mask',
          e('input', {
            id: 'beforeMask',
            value: beforeMaskText,
            onBeforeInput: (ev) => {
              const data = (ev.nativeEvent && ev.nativeEvent.data) || ev.data || '';
              if (!data) return;
              ev.preventDefault();
              setBeforeMaskCount((count) => count + 1);
              setBeforeMaskText((value) => value + data.toUpperCase());
              setSubmitted(false);
            },
            onChange: (ev) => {
              setBeforeMaskText(ev.target.value.toUpperCase());
              setSubmitted(false);
            }
          })
        ),
        e('label', null, 'Undo',
          e('input', {
            id: 'undoProbe',
            value: undoProbe,
            onChange: (ev) => {
              const nextValue = ev.target.value;
              setUndoProbe(nextValue);
              if (nextValue === '') setUndoVisitedEmpty(true);
              setSubmitted(false);
            }
          })
        ),
        e('label', null, 'Reset',
          e('input', {
            id: 'resetProbe',
            value: resetProbe,
            onChange: (ev) => { setResetProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('button', { id: 'resetButton', type: 'reset' }, 'Reset Action'),
        e('label', null, 'Copy',
          e('input', {
            id: 'copyProbe',
            value: copyProbe,
            onCopy: () => { setCopyCount((count) => count + 1); },
            onChange: (ev) => { setCopyProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Cut',
          e('input', {
            id: 'cutProbe',
            value: cutProbe,
            onCut: () => { setCutCount((count) => count + 1); },
            onChange: (ev) => { setCutProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { id: 'comboBox' },
          e('label', null, 'Combo',
            e('input', {
              id: 'comboInput',
              role: 'combobox',
              value: comboQuery,
              'aria-expanded': comboOpen ? 'true' : 'false',
              onFocus: () => { setComboOpen(true); setSubmitted(false); },
              onChange: (ev) => { setComboQuery(ev.target.value); setComboOpen(true); setSubmitted(false); },
              onKeyDown: (ev) => {
                if (ev.key === 'Escape') setComboOpen(false);
              }
            })
          ),
          comboOpen && e('ul', { id: 'comboList', role: 'listbox' },
            ['Alpha', 'Beta'].filter((item) => item.toLowerCase().includes(comboQuery.toLowerCase())).map((item) =>
              e('li', {
                id: 'comboOption' + item,
                key: item,
                role: 'option',
                onMouseDown: (ev) => {
                  ev.preventDefault();
                  setComboMouseDowns((count) => count + 1);
                  setComboChoice(item);
                  setComboOpen(false);
                  window.setTimeout(() => {
                    setComboFocusKept(document.activeElement && document.activeElement.id === 'comboInput');
                  }, 0);
                  setSubmitted(false);
                }
              }, item)
            )
          ),
          e('span', { id: 'comboResult' }, comboOk ? 'ok:combo:' + comboChoice : 'state:combo:' + comboQuery + ':' + comboChoice + ':' + comboMouseDowns + ':' + comboOpen)
        ),
        e('div', { id: 'keyboardComboBox' },
          e('label', null, 'Keyboard Combo',
            e('input', {
              id: 'keyboardComboInput',
              role: 'combobox',
              value: keyboardComboQuery,
              'aria-expanded': keyboardComboOpen ? 'true' : 'false',
              'aria-activedescendant': keyboardComboOpen && keyboardComboOptions[keyboardComboActive] ? 'keyboardComboOption' + keyboardComboOptions[keyboardComboActive] : undefined,
              onFocus: () => { setKeyboardComboOpen(true); setSubmitted(false); },
              onChange: (ev) => {
                setKeyboardComboQuery(ev.target.value);
                setKeyboardComboActive(0);
                setKeyboardComboOpen(true);
                setSubmitted(false);
              },
              onKeyDown: (ev) => {
                if (ev.key === 'ArrowDown') {
                  ev.preventDefault();
                  setKeyboardComboActive((index) => Math.min(index + 1, Math.max(0, keyboardComboOptions.length - 1)));
                }
                if (ev.key === 'ArrowUp') {
                  ev.preventDefault();
                  setKeyboardComboActive((index) => Math.max(0, index - 1));
                }
                if (ev.key === 'Enter' && keyboardComboOpen && keyboardComboOptions[keyboardComboActive]) {
                  ev.preventDefault();
                  setKeyboardComboChoice(keyboardComboOptions[keyboardComboActive]);
                  setKeyboardComboOpen(false);
                  setSubmitted(false);
                }
              }
            })
          ),
          keyboardComboOpen && e('ul', { id: 'keyboardComboList', role: 'listbox' },
            keyboardComboOptions.map((item, index) =>
              e('li', {
                id: 'keyboardComboOption' + item,
                key: item,
                role: 'option',
                'aria-selected': index === keyboardComboActive ? 'true' : 'false'
              }, (index === keyboardComboActive ? '> ' : '') + item)
            )
          ),
          e('span', { id: 'keyboardComboResult' }, keyboardComboOk ? 'ok:keyboard-combo:' + keyboardComboChoice : 'state:keyboard-combo:' + keyboardComboQuery + ':' + keyboardComboActive + ':' + keyboardComboChoice + ':' + keyboardComboOpen)
        ),
        e('div', { id: 'rovingMenuBlock' },
          e('button', {
            id: 'rovingMenuTrigger',
            type: 'button',
            'aria-haspopup': 'menu',
            'aria-expanded': rovingMenuOpen ? 'true' : 'false',
            onClick: () => {
              setRovingMenuOpen(true);
              setRovingMenuActive(0);
              setSubmitted(false);
            }
          }, 'Roving Menu'),
          rovingMenuOpen && e('div', { id: 'rovingMenu', role: 'menu' },
            rovingMenuItems.map((item, index) =>
              e('button', {
                id: 'rovingMenuItem' + item,
                key: item,
                type: 'button',
                role: 'menuitem',
                tabIndex: index === rovingMenuActive ? 0 : -1,
                ref: (node) => { rovingMenuRefs.current[index] = node; },
                onFocus: () => { setRovingMenuFocus((count) => count + 1); },
                onKeyDown: (ev) => handleRovingMenuKeyDown(ev, item, index),
                onClick: () => chooseRovingMenuItem(item)
              }, (index === rovingMenuActive ? '> ' : '') + item)
            )
          ),
          e('span', { id: 'rovingMenuResult' }, rovingMenuOk ? 'ok:roving-menu:' + rovingMenuChoice : 'state:roving-menu:' + rovingMenuActive + ':' + rovingMenuChoice + ':' + rovingMenuFocus + ':' + rovingMenuKeys.join('|') + ':' + rovingMenuOpen)
        ),
        e('label', null, 'Capture Phase',
          e('input', {
            id: 'capturePhaseInput',
            value: captureText,
            onKeyDownCapture: () => { setCaptureEvents((prev) => ({ ...prev, keyDown: prev.keyDown + 1 })); },
            onChange: (ev) => { setCaptureText(ev.target.value); setSubmitted(false); }
          })
        ),
        e('button', {
          id: 'capturePhaseButton',
          type: 'button',
          onPointerDownCapture: () => { setCaptureEvents((prev) => ({ ...prev, pointerDown: prev.pointerDown + 1 })); },
          onClickCapture: () => { setCaptureEvents((prev) => ({ ...prev, click: prev.click + 1 })); },
          onClick: () => { setSubmitted(false); }
        }, 'Capture Phase Button'),
        e('span', { id: 'capturePhaseResult' }, captureOk ? 'ok:capture:' + captureText : 'state:capture:' + captureText + ':' + captureEvents.keyDown + ':' + captureEvents.pointerDown + ':' + captureEvents.click),
        e('label', null, 'Paste',
          e('input', {
            id: 'pasteProbe',
            value: pasteProbe,
            onPaste: () => { setPasteCount((count) => count + 1); },
            onChange: (ev) => { setPasteProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Paste Shortcut',
          e('input', {
            id: 'pasteShortcutProbe',
            value: pasteShortcutProbe,
            onPaste: () => { setPasteShortcutCount((count) => count + 1); },
            onChange: (ev) => { setPasteShortcutProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Paste Data',
          e('input', {
            id: 'pasteDataProbe',
            value: pasteDataProbe,
            onPaste: (ev) => {
              setPasteDataRead(ev.clipboardData ? ev.clipboardData.getData('text/plain') : '');
              setPasteDataCount((count) => count + 1);
              setSubmitted(false);
            },
            onChange: (ev) => { setPasteDataProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Agree',
          e('input', {
            id: 'agree',
            type: 'checkbox',
            checked,
            onChange: (ev) => { setChecked(ev.target.checked); setSubmitted(false); }
          })
        ),
        e('label', null, 'Choice',
          e('select', {
            id: 'choice',
            value: choice,
            onChange: (ev) => { setChoice(ev.target.value); setSubmitted(false); }
          },
            e('option', { value: 'a' }, 'Alpha'),
            e('option', { value: 'b' }, 'Beta')
          )
        ),
        e('fieldset', null,
          e('legend', null, 'Speed'),
          e('label', null,
            e('input', {
              id: 'speedSlow',
              name: 'speed',
              type: 'radio',
              value: 'slow',
              checked: speed === 'slow',
              onChange: (ev) => { setSpeed(ev.target.value); setSubmitted(false); }
            }),
            'Slow'
          ),
          e('label', null,
            e('input', {
              id: 'speedFast',
              name: 'speed',
              type: 'radio',
              value: 'fast',
              checked: speed === 'fast',
              onChange: (ev) => { setSpeed(ev.target.value); setSubmitted(false); }
            }),
            'Fast'
          )
        ),
        e('label', null, 'Keyboard Native Check',
          e('input', {
            id: 'keyboardNativeCheck',
            type: 'checkbox',
            checked: keyboardNativeChecked,
            onChange: (ev) => { setKeyboardNativeChecked(ev.target.checked); setSubmitted(false); }
          })
        ),
        e('fieldset', null,
          e('legend', null, 'Keyboard Native Radio'),
          e('label', null,
            e('input', {
              id: 'keyboardNativeRadioLeft',
              name: 'keyboardNativeRadio',
              type: 'radio',
              value: 'left',
              checked: keyboardNativeRadio === 'left',
              onChange: (ev) => { setKeyboardNativeRadio(ev.target.value); setSubmitted(false); }
            }),
            'Left'
          ),
          e('label', null,
            e('input', {
              id: 'keyboardNativeRadioRight',
              name: 'keyboardNativeRadio',
              type: 'radio',
              value: 'right',
              checked: keyboardNativeRadio === 'right',
              onChange: (ev) => { setKeyboardNativeRadio(ev.target.value); setSubmitted(false); }
            }),
            'Right'
          )
        ),
        e('label', null, 'Keyboard Range',
          e('input', {
            id: 'keyboardRangeProbe',
            type: 'range',
            min: '0',
            max: '100',
            value: keyboardRangeValue,
            onChange: (ev) => { setKeyboardRangeValue(ev.target.value); setSubmitted(false); }
          }),
          e('span', { id: 'keyboardRangeValue' }, keyboardRangeValue)
        ),
        e('label', null, 'Range',
          e('input', {
            id: 'rangeProbe',
            type: 'range',
            min: '0',
            max: '100',
            value: volume,
            onChange: (ev) => { setVolume(ev.target.value); setSubmitted(false); }
          }),
          e('span', { id: 'rangeValue' }, volume)
        ),
        e('label', null, 'Drag Range',
          e('input', {
            id: 'dragRangeProbe',
            type: 'range',
            min: '0',
            max: '100',
            value: dragVolume,
            onChange: (ev) => { setDragVolume(ev.target.value); setSubmitted(false); }
          }),
          e('span', { id: 'dragRangeValue' }, dragVolume)
        ),
        e('label', null, 'Rich',
          e('div', {
            id: 'rich',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onInput: (ev) => { setRich(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('label', null, 'Rich Clipboard',
          e('div', {
            id: 'richClipboard',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onPaste: (ev) => {
              setRichClipboardData(ev.clipboardData ? ev.clipboardData.getData('text/plain') : '');
              setRichPasteCount((count) => count + 1);
            },
            onCut: () => { setRichCutCount((count) => count + 1); },
            onInput: (ev) => { setRichClipboard(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('label', null, 'Rich IME',
          e('div', {
            id: 'richIme',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onCompositionStart: () => { setRichImeComposition((prev) => ({ ...prev, start: prev.start + 1 })); },
            onCompositionUpdate: () => { setRichImeComposition((prev) => ({ ...prev, update: prev.update + 1 })); },
            onCompositionEnd: () => { setRichImeComposition((prev) => ({ ...prev, end: prev.end + 1 })); },
            onInput: (ev) => { setRichIme(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('label', null, 'Rich Replace',
          e('div', {
            id: 'richReplace',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onInput: (ev) => { setRichReplace(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('label', null, 'Rich Mouse Replace',
          e('div', {
            id: 'richMouseReplace',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onInput: (ev) => { setRichMouseReplace(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('label', null, 'Rich Double Replace',
          e('div', {
            id: 'richDoubleReplace',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onInput: (ev) => { setRichDoubleReplace(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('canvas', {
          id: 'drawCanvas',
          width: 300,
          height: 120,
          onPointerDown: (ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            const rect = ev.currentTarget.getBoundingClientRect();
            const x = Math.round((ev.clientX - rect.left) * ev.currentTarget.width / rect.width);
            const y = Math.round((ev.clientY - rect.top) * ev.currentTarget.height / rect.height);
            setCanvasDraw((prev) => ({ ...prev, down: prev.down + 1, startX: x, startY: y, lastX: x, lastY: y }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            const rect = ev.currentTarget.getBoundingClientRect();
            const x = Math.round((ev.clientX - rect.left) * ev.currentTarget.width / rect.width);
            const y = Math.round((ev.clientY - rect.top) * ev.currentTarget.height / rect.height);
            setCanvasDraw((prev) => ({
              ...prev,
              move: prev.move + 1,
              lastX: x,
              lastY: y,
              maxDx: Math.max(prev.maxDx, Math.abs(x - prev.startX)),
              maxDy: Math.max(prev.maxDy, Math.abs(y - prev.startY))
            }));
            setSubmitted(false);
          },
          onPointerUp: (ev) => {
            const rect = ev.currentTarget.getBoundingClientRect();
            const x = Math.round((ev.clientX - rect.left) * ev.currentTarget.width / rect.width);
            const y = Math.round((ev.clientY - rect.top) * ev.currentTarget.height / rect.height);
            setCanvasDraw((prev) => ({
              ...prev,
              up: prev.up + 1,
              lastX: x,
              lastY: y,
              maxDx: Math.max(prev.maxDx, Math.abs(x - prev.startX)),
              maxDy: Math.max(prev.maxDy, Math.abs(y - prev.startY))
            }));
            setSubmitted(false);
          }
        }),
        e('svg', {
          id: 'svgBoard',
          viewBox: '0 0 320 120',
          onPointerDown: (ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            const point = ev.currentTarget.createSVGPoint();
            point.x = ev.clientX;
            point.y = ev.clientY;
            const local = point.matrixTransform(ev.currentTarget.getScreenCTM().inverse());
            const x = Math.round(local.x);
            const y = Math.round(local.y);
            setSvgPointer((prev) => ({ ...prev, down: prev.down + 1, startX: x, startY: y, lastX: x, lastY: y }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            const point = ev.currentTarget.createSVGPoint();
            point.x = ev.clientX;
            point.y = ev.clientY;
            const local = point.matrixTransform(ev.currentTarget.getScreenCTM().inverse());
            const x = Math.round(local.x);
            const y = Math.round(local.y);
            setSvgPointer((prev) => ({
              ...prev,
              move: prev.move + 1,
              lastX: x,
              lastY: y,
              maxDx: Math.max(prev.maxDx, Math.abs(x - prev.startX)),
              maxDy: Math.max(prev.maxDy, Math.abs(y - prev.startY))
            }));
            setSubmitted(false);
          },
          onPointerUp: (ev) => {
            const point = ev.currentTarget.createSVGPoint();
            point.x = ev.clientX;
            point.y = ev.clientY;
            const local = point.matrixTransform(ev.currentTarget.getScreenCTM().inverse());
            const x = Math.round(local.x);
            const y = Math.round(local.y);
            setSvgPointer((prev) => ({
              ...prev,
              up: prev.up + 1,
              lastX: x,
              lastY: y,
              maxDx: Math.max(prev.maxDx, Math.abs(x - prev.startX)),
              maxDy: Math.max(prev.maxDy, Math.abs(y - prev.startY))
            }));
            setSubmitted(false);
          }
        },
          e('rect', { x: 0, y: 0, width: 320, height: 120, fill: '#eef5ff' }),
          e('circle', { cx: 60, cy: 60, r: 22, fill: '#6b8fc9' }),
          e('circle', { cx: svgPointer.lastX || 60, cy: svgPointer.lastY || 60, r: 8, fill: '#2d4f7c' })
        ),
        e('div', {
          id: 'pointerPad',
          onPointerDown: (ev) => {
            setPointer((prev) => ({ ...prev, down: prev.down + 1, startX: ev.clientX }));
            setPointerButtonProbe((prev) => ({ ...prev, downButton: ev.button, downButtons: ev.buttons }));
            setPointerMetaProbe((prev) => ({
              ...prev,
              downId: ev.pointerId,
              pointerType: ev.pointerType,
              isPrimary: ev.isPrimary
            }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            setPointer((prev) => ({
              ...prev,
              move: prev.move + 1,
              totalDx: Math.max(prev.totalDx, Math.abs(ev.clientX - prev.startX))
            }));
            setPointerButtonProbe((prev) => ({ ...prev, moveButtons: Math.max(prev.moveButtons, ev.buttons) }));
            setPointerMetaProbe((prev) => ({ ...prev, moveId: ev.pointerId }));
            setSubmitted(false);
          },
          onPointerUp: (ev) => {
            setPointer((prev) => ({ ...prev, up: prev.up + 1 }));
            setPointerButtonProbe((prev) => ({ ...prev, upButton: ev.button, upButtons: ev.buttons }));
            setPointerMetaProbe((prev) => ({ ...prev, upId: ev.pointerId }));
            setSubmitted(false);
          },
          onWheel: (ev) => {
            ev.preventDefault();
            setPointer((prev) => ({ ...prev, wheel: prev.wheel + 1, wheelY: prev.wheelY + Math.abs(ev.deltaY) }));
            setSubmitted(false);
          }
        }, 'Pointer target'),
        e('div', {
          id: 'touchPad',
          onTouchStart: (ev) => {
            const touchPoint = ev.touches[0] || ev.changedTouches[0];
            setTouch((prev) => ({ ...prev, start: prev.start + 1, startX: touchPoint ? touchPoint.clientX : prev.startX }));
            setSubmitted(false);
          },
          onTouchMove: (ev) => {
            const touchPoint = ev.touches[0] || ev.changedTouches[0];
            if (!touchPoint) return;
            setTouch((prev) => ({
              ...prev,
              move: prev.move + 1,
              totalDx: Math.max(prev.totalDx, Math.abs(touchPoint.clientX - prev.startX))
            }));
            setSubmitted(false);
          },
          onTouchEnd: (ev) => {
            const touchPoint = ev.changedTouches[0] || ev.touches[0];
            setTouch((prev) => ({
              ...prev,
              end: prev.end + 1,
              endDx: touchPoint ? Math.max(prev.endDx, Math.abs(touchPoint.clientX - prev.startX)) : prev.endDx,
              endChanged: Math.max(prev.endChanged, ev.changedTouches.length)
            }));
            setSubmitted(false);
          }
        }, 'Touch target'),
        e('div', {
          id: 'multiTouchPad',
          onTouchStart: (ev) => {
            const distance = touchDistance(ev.touches);
            setMultiTouch((prev) => ({
              ...prev,
              startMax: Math.max(prev.startMax, ev.touches.length),
              startDistance: Math.max(prev.startDistance, distance)
            }));
            setSubmitted(false);
          },
          onTouchMove: (ev) => {
            const distance = touchDistance(ev.touches);
            setMultiTouch((prev) => ({
              ...prev,
              moveMax: Math.max(prev.moveMax, ev.touches.length),
              moveDistance: Math.max(prev.moveDistance, distance)
            }));
            setSubmitted(false);
          },
          onTouchEnd: (ev) => {
            const distance = touchDistance(ev.changedTouches);
            setMultiTouch((prev) => ({
              ...prev,
              endChangedMax: Math.max(prev.endChangedMax, ev.changedTouches.length),
              endDistance: Math.max(prev.endDistance, distance)
            }));
            setSubmitted(false);
          }
        }, 'Multi-touch target'),
        e('div', {
          id: 'edgeDragPad',
          onPointerDown: (ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            setEdgeDrag((prev) => ({ ...prev, down: prev.down + 1, maxX: Math.max(prev.maxX, ev.clientX) }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            setEdgeDrag((prev) => ({ ...prev, move: prev.move + 1, maxX: Math.max(prev.maxX, ev.clientX) }));
            setSubmitted(false);
          },
          onPointerUp: (ev) => {
            setEdgeDrag((prev) => ({ ...prev, up: prev.up + 1, upX: Math.max(prev.upX, ev.clientX) }));
            setSubmitted(false);
          }
        }, 'Edge drag'),
        e('div', {
          id: 'capturePad',
          onPointerDown: (ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            setPointerCapture((prev) => ({ ...prev, down: prev.down + 1, startX: ev.clientX }));
            setSubmitted(false);
          },
          onGotPointerCapture: () => {
            setPointerCapture((prev) => ({ ...prev, got: prev.got + 1 }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            setPointerCapture((prev) => ({
              ...prev,
              move: prev.move + 1,
              maxDx: Math.max(prev.maxDx, Math.abs(ev.clientX - prev.startX))
            }));
            setSubmitted(false);
          },
          onPointerUp: () => {
            setPointerCapture((prev) => ({ ...prev, up: prev.up + 1 }));
            setSubmitted(false);
          },
          onLostPointerCapture: () => {
            setPointerCapture((prev) => ({ ...prev, lost: prev.lost + 1 }));
            setSubmitted(false);
          }
        }, 'Capture target'),
        e('div', {
          id: 'hoverPad',
          onMouseEnter: () => { setHover((prev) => ({ ...prev, enter: prev.enter + 1 })); setSubmitted(false); },
          onMouseMove: () => { setHover((prev) => ({ ...prev, move: prev.move + 1 })); setSubmitted(false); },
          onMouseLeave: () => { setHover((prev) => ({ ...prev, leave: prev.leave + 1 })); setSubmitted(false); }
        }, 'Hover target'),
        e('div', {
          id: 'pointerHoverPad',
          onPointerEnter: () => { setPointerHover((prev) => ({ ...prev, enter: prev.enter + 1 })); setSubmitted(false); },
          onPointerMove: () => { setPointerHover((prev) => ({ ...prev, move: prev.move + 1 })); setSubmitted(false); },
          onPointerLeave: () => { setPointerHover((prev) => ({ ...prev, leave: prev.leave + 1 })); setSubmitted(false); }
        }, 'Pointer hover target'),
        e('div', {
          id: 'pointerReorder',
          onPointerMove: (ev) => {
            const drag = reorderDragRef.current;
            if (!drag || !ev.buttons) return;
            const deltaY = ev.clientY - drag.startY;
            if (deltaY > 38 && !drag.moved) {
              drag.moved = true;
              setReorderMoves((count) => count + 1);
              setReorderItems((items) => {
                const from = items.indexOf(drag.item);
                if (from < 0 || from >= items.length - 1) return items;
                const next = items.slice();
                const removed = next.splice(from, 1)[0];
                next.splice(from + 1, 0, removed);
                return next;
              });
              setSubmitted(false);
            }
          },
          onPointerUp: () => {
            if (reorderDragRef.current) {
              reorderDragRef.current = null;
              setReorderDrops((count) => count + 1);
              setSubmitted(false);
            }
          },
          onPointerCancel: () => {
            reorderDragRef.current = null;
          }
        },
          reorderItems.map((item) => e('div', {
            key: item,
            id: 'pointerReorder' + item,
            className: 'reorderItem',
            onPointerDown: (ev) => {
              ev.currentTarget.parentElement.setPointerCapture(ev.pointerId);
              reorderDragRef.current = { item, startY: ev.clientY, moved: false };
              setSubmitted(false);
            }
          }, 'Pointer Reorder ' + item))
        ),
        e('div', {
          id: 'dragSource',
          draggable: true,
          onDragStart: (ev) => {
            ev.dataTransfer.setData('text/plain', 'card');
            setDragDrop((prev) => ({ ...prev, start: prev.start + 1 }));
            setSubmitted(false);
          },
          onDragEnd: () => {
            setDragDrop((prev) => ({ ...prev, end: prev.end + 1 }));
            setSubmitted(false);
          },
        }, 'Drag card'),
        e('div', {
          id: 'dropZone',
          onDragEnter: () => {
            setDragDrop((prev) => ({ ...prev, enter: prev.enter + 1 }));
            setSubmitted(false);
          },
          onDragOver: (ev) => {
            ev.preventDefault();
            setDragDrop((prev) => ({ ...prev, over: prev.over + 1 }));
            setSubmitted(false);
          },
          onDrop: (ev) => {
            ev.preventDefault();
            setDragDrop((prev) => ({ ...prev, drop: prev.drop + 1, payload: ev.dataTransfer.getData('text/plain') }));
            setSubmitted(false);
          }
        }, dragDropOk ? 'Dropped' : 'Drop here'),
        e('div', {
          id: 'scrollBox',
          onScroll: (ev) => {
            setScrollTop(ev.currentTarget.scrollTop);
            setSubmitted(false);
          }
        },
          Array.from({ length: 16 }, (_, index) => e('div', { key: index }, 'Scrollable row ' + (index + 1)))
        ),
        e('div', {
          id: 'virtualList',
          onScroll: (ev) => {
            setVirtualScrollTop(ev.currentTarget.scrollTop);
            setSubmitted(false);
          }
        },
          e('div', { id: 'virtualListInner' },
            virtualRows.map((index) => e('button', {
              key: index,
              id: 'virtualRow' + index,
              type: 'button',
              className: 'virtualRow',
              style: { top: (index * 34) + 'px' },
              onClick: () => { setVirtualChoice('Row ' + index); setSubmitted(false); }
            }, 'Row ' + index))
          )
        ),
        e('div', {
          id: 'customSlider',
          role: 'slider',
          tabIndex: 0,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': customSliderValue,
          onPointerDown: (ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            const rect = ev.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            setCustomSliderValue(Math.round(ratio * 100));
            setCustomSliderPointerEvents((count) => count + 1);
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            const rect = ev.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            setCustomSliderValue(Math.round(ratio * 100));
            setCustomSliderPointerEvents((count) => count + 1);
            setSubmitted(false);
          },
          onKeyDown: (ev) => {
            if (ev.key === 'Home' || ev.key === 'End' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
              ev.preventDefault();
              setCustomSliderKeyEvents((count) => count + 1);
              setCustomSliderValue((value) => {
                if (ev.key === 'Home') return 0;
                if (ev.key === 'End') return 100;
                return Math.max(0, Math.min(100, value + (ev.key === 'ArrowRight' ? 10 : -10)));
              });
              setSubmitted(false);
            }
          }
        }, 'Custom Slider ' + customSliderValue),
        e('div', { id: 'pageScrollSpacer' }, 'Page scroll spacer'),
        e('button', {
          id: 'pageScrollCount',
          type: 'button',
          onClick: () => { setPageScrollClicks((count) => count + 1); setSubmitted(false); }
        }, 'Page Scroll Count'),
        e('iframe', {
          id: 'reactFrameClient',
          src: 'http://127.0.0.1:9585/frame',
          title: 'React client iframe smoke'
        }),
        e('browser-lab-client-shadow', { id: 'shadowClientHost' }),
        e('button', {
          id: 'count',
          type: 'button',
          onClick: () => { setClicks((count) => count + 1); setSubmitted(false); }
        }, 'Count'),
        e('button', {
          id: 'shiftCount',
          type: 'button',
          onClick: (ev) => {
            if (ev.shiftKey) setShiftClicks((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Shift Count'),
        e('button', {
          id: 'scaledCount',
          type: 'button',
          onClick: () => { setScaledClicks((count) => count + 1); setSubmitted(false); }
        }, 'Scaled Count'),
        e('div', { id: 'transformShell' },
          e('div', { id: 'transformPanel' },
            e('button', {
              id: 'transformButton',
              type: 'button',
              onClick: () => { setTransformClicks((count) => count + 1); setSubmitted(false); }
            }, 'Transformed Button')
          )
        ),
        e('button', {
          id: 'doubleCount',
          type: 'button',
          onDoubleClick: () => { setDoubleClicks((count) => count + 1); setSubmitted(false); }
        }, 'Double Count'),
        e('button', {
          id: 'contextCount',
          type: 'button',
          onContextMenu: (ev) => {
            ev.preventDefault();
            setContextMenus((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Context Count'),
        e('button', {
          id: 'auxCount',
          type: 'button',
          onAuxClick: (ev) => {
            ev.preventDefault();
            if (ev.button === 1) setAuxClicks((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Aux Count'),
        e('button', {
          id: 'keyboardCount',
          type: 'button',
          onFocus: () => { setKeyboardFocusCount((count) => count + 1); },
          onClick: () => { setKeyboardClicks((count) => count + 1); setSubmitted(false); }
        }, 'Keyboard Count'),
        e('div', {
          id: 'roleButton',
          role: 'button',
          tabIndex: 0,
          onClick: () => { setRoleButtonClicks((count) => count + 1); setSubmitted(false); },
          onKeyDown: (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              setRoleButtonKeys((keys) => keys.concat(ev.key));
              setRoleButtonClicks((count) => count + 1);
              setSubmitted(false);
            }
          },
          style: { display: 'inline-block', border: '2px solid #5a6f8f', padding: '10px', margin: '6px' }
        }, 'Role Button Count'),
        e('button', { id: 'submit', type: 'submit', disabled: !ok }, 'Submit'),
        e('div', { id: 'result' },
          submitted && ok
            ? 'ok:' + name + ':' + alias + ':composition:' + notes.replace('\\n', '|') + ':space:' + spaceText + ':' + switchSpaceCount + ':edit:' + editBackspace + ':' + editReplace + ':' + editDelete + ':partialreplace:' + selectionReplace + ':partialdelete:' + selectionDelete + ':mousereplace:' + mouseSelectionReplace + ':doublereplace:' + doubleSelectionReplace + ':enter:' + enterSubmitText + ':ctrlenter:' + ctrlEnterCount + ':' + ctrlEnterText + ':shiftenter:' + shiftEnterCount + ':' + shiftEnterText.replace('\\n', '|') + ':focusblur:' + focusBlurText + ':related:' + relatedBlurTarget + ':debounce:' + debouncedValue + ':validation:' + invalidCount + ':' + validationSubmitCount + ':special:' + passwordText.length + ':' + numberText + ':' + searchSubmitCount + ':' + labelText + ':contact:' + emailBlurCount + ':' + telText + ':' + urlText + ':datetime:' + dateText + ':' + timeText + ':' + datetimeLocalText + ':' + monthText + ':' + weekText + ':' + colorText + ':file:' + fileNames + ':filedrop:' + dropFileName + ':input:' + inputEventText + ':keyup:' + keyUpCount + ':inputtype:' + (inputTypeOk ? '1' : '0') + ':trusted:' + (trustedOk ? '1' : '0') + ':mask:' + beforeMaskText + ':undo:' + undoProbe + ':reset:' + resetCount + ':copy:' + copyCount + ':partialcopy:' + (partialCopyOk ? '1' : '0') + ':cut:' + cutCount + ':combo:' + comboChoice + ':keyboardcombo:' + keyboardComboChoice + ':rovingmenu:' + rovingMenuChoice + ':capture:' + captureEvents.keyDown + ':' + pasteProbe + ':pastekey:' + pasteShortcutProbe + ':pastedata:' + pasteDataRead + ':controls:' + choice + ':' + speed + ':' + rich + ':nativekeys:' + (keyboardNativeChecked ? '1' : '0') + ':' + keyboardNativeRadio + ':' + keyboardRangeValue + ':richclip:' + richPasteCount + ':' + richCutCount + ':' + richClipboardData + ':richime:' + richIme + ':richreplace:' + richReplace + ':richmousereplace:' + (richMouseReplaceOk ? '1' : '0') + ':richdoublereplace:' + richDoubleReplace + ':spa:shortcut:' + codeShortcutCount + ':dragdrop:scroll:virtual:' + virtualChoice + ':customslider:' + customSliderValue + ':pagescroll:shadow:scaled:transform:range:' + volume + ':dragrange:' + dragVolume + ':pointerreorder:' + reorderItems.join('') + ':rolebutton:' + roleButtonClicks + ':portal:portalmenu:' + portalMenuChoice + ':portaltrap:' + (portalTrapOk ? '1' : '0') + ':canvasdraw:' + (canvasDrawOk ? '1' : '0') + ':svgpointer:' + (svgPointerOk ? '1' : '0') + ':pointer:pointerbuttons:' + (pointerButtonOk ? '1' : '0') + ':pointermeta:' + (pointerMetaOk ? '1' : '0') + ':touchend:' + touch.endChanged + ':multitouch:' + (multiTouchOk ? '1' : '0') + ':edgedrag:' + (edgeDragOk ? '1' : '0') + ':capture:pointerhover:modifier:gestures:keyboard:' + clicks
            : 'state:' + JSON.stringify(state)
        ),
        ReactDOM.createPortal(
          e('div', { id: 'portalPanel' },
            e('strong', null, 'Portal'),
            e('input', {
              id: 'portalInput',
              value: portalText,
              onChange: (ev) => { setPortalText(ev.target.value); setSubmitted(false); }
            }),
            e('button', {
              id: 'portalButton',
              type: 'button',
              onClick: () => { setPortalClicks((count) => count + 1); setSubmitted(false); }
            }, 'Portal Count'),
            e('span', { id: 'portalResult' }, portalOk ? 'ok:portal:' + portalText : 'state:portal:' + portalText + ':' + portalClicks),
            e('button', {
              id: 'portalMenuTrigger',
              type: 'button',
              onClick: () => { setPortalMenuOpen(true); setSubmitted(false); }
            }, 'Open Menu'),
            portalMenuOpen && e('div', {
              id: 'portalMenuPanel',
              role: 'menu',
              tabIndex: -1,
              style: { border: '2px solid #35648b', marginTop: '8px', padding: '8px', width: '180px' }
            },
              e('button', {
                id: 'portalMenuItemSave',
                type: 'button',
                role: 'menuitem',
                onFocus: () => { setPortalMenuFocus((count) => count + 1); },
                onClick: () => {
                  setPortalMenuChoice('Save');
                  setPortalMenuOpen(false);
                  setSubmitted(false);
                }
              }, 'Save'),
              e('button', {
                id: 'portalMenuItemCancel',
                type: 'button',
                role: 'menuitem',
                onFocus: () => { setPortalMenuFocus((count) => count + 1); },
                onClick: () => {
                  setPortalMenuChoice('Cancel');
                  setPortalMenuOpen(false);
                  setSubmitted(false);
                }
              }, 'Cancel')
            ),
            e('span', { id: 'portalMenuResult' }, portalMenuOk ? 'ok:portal-menu:' + portalMenuChoice : 'state:portal-menu:' + portalMenuChoice + ':' + portalMenuEscape + ':' + portalMenuOutside + ':' + portalMenuFocus + ':' + portalMenuOpen),
            e('button', {
              id: 'portalTrapTrigger',
              type: 'button',
              onClick: () => { setPortalTrapOpen(true); setSubmitted(false); }
            }, 'Open Trap'),
            portalTrapOpen && e('div', {
              id: 'portalTrapDialog',
              role: 'dialog',
              'aria-modal': 'true',
              onKeyDown: handlePortalTrapKeyDown,
              style: { border: '2px solid #7a4d83', marginTop: '8px', padding: '8px', width: '230px' }
            },
              e('input', {
                id: 'portalTrapFirst',
                value: portalTrapText,
                onFocus: () => { setPortalTrapFocusLog((log) => log.concat('first')); },
                onChange: (ev) => { setPortalTrapText(ev.target.value); setSubmitted(false); }
              }),
              e('button', {
                id: 'portalTrapSecond',
                type: 'button',
                onFocus: () => { setPortalTrapFocusLog((log) => log.concat('second')); },
                onClick: () => { setSubmitted(false); }
              }, 'Trap Second')
            ),
            e('span', { id: 'portalTrapResult' }, portalTrapOk ? 'ok:portal-trap:' + portalTrapText : 'state:portal-trap:' + portalTrapText + ':' + portalTrapTabs + ':' + portalTrapFocusLog.join('|') + ':' + portalTrapOpen)
          ),
          document.getElementById('portalRoot')
        )
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(e(App));
  </script>
</body>
</html>
"""


FRAME_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React Client Iframe Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 12px; margin: 0; }
    input { font-size: 18px; padding: 7px; width: 330px; }
    #frameClientResult { margin-top: 12px; font-size: 18px; font-weight: 700; }
  </style>
</head>
<body>
  <div id="frameRoot">loading frame react...</div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script>
    const e = React.createElement;
    function FrameApp() {
      const [value, setValue] = React.useState('');
      const [pasteCount, setPasteCount] = React.useState(0);
      const [composition, setComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const compositionOk = composition.start >= 1 && composition.update >= 1 && composition.end >= 1;
      const ok = value === 'frame\\uD55C\\uAE00clip' && pasteCount === 1 && compositionOk;
      window.__browserLabClientFrameSmokeState = { value, pasteCount, composition, compositionOk, ok };
      return e('div', null,
        e('label', null, 'Frame Input ',
          e('input', {
            id: 'frameClientInput',
            value,
            onCompositionStart: () => setComposition((prev) => ({ ...prev, start: prev.start + 1 })),
            onCompositionUpdate: () => setComposition((prev) => ({ ...prev, update: prev.update + 1 })),
            onCompositionEnd: () => setComposition((prev) => ({ ...prev, end: prev.end + 1 })),
            onPaste: () => setPasteCount((count) => count + 1),
            onChange: (ev) => setValue(ev.target.value)
          })
        ),
        e('div', { id: 'frameClientResult' }, ok ? 'ok:frame:' + value : 'state:' + JSON.stringify(window.__browserLabClientFrameSmokeState))
      );
    }
    ReactDOM.createRoot(document.getElementById('frameRoot')).render(e(FrameApp));
  </script>
</body>
</html>
"""


class FixtureHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(FIXTURE_HTML)))
        self.end_headers()
        self.wfile.write(FIXTURE_HTML)

    def log_message(self, *_args: Any) -> None:
        pass


class FrameHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(FRAME_HTML)))
        self.end_headers()
        self.wfile.write(FRAME_HTML)

    def log_message(self, *_args: Any) -> None:
        pass


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None:
        pass


def start_http_server(server: ThreadingHTTPServer) -> threading.Thread:
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return thread


def configure_runtime() -> None:
    os.environ["TG_BROWSER_LAB_HEADLESS"] = "1"
    os.environ["TG_BROWSER_LAB_PROFILE_DIR"] = str(PROFILE_DIR)
    os.environ["TG_BROWSER_LAB_RUNTIME_DIR"] = str(RUNTIME_DIR)
    shutil.rmtree(PROFILE_DIR, ignore_errors=True)
    shutil.rmtree(RUNTIME_DIR, ignore_errors=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_PATH.write_text("react upload fixture", encoding="utf-8")
    DROP_PATH.write_text("react drop fixture", encoding="utf-8")


async def wait_for(predicate, label: str, timeout: float = 30.0) -> None:
    started = time.monotonic()
    while time.monotonic() - started < timeout:
        if await predicate():
            return
        await asyncio.sleep(0.1)
    raise TimeoutError(label)


async def remote_state(controller: Any) -> Dict[str, Any]:
    if not controller.page:
        return {}
    state = await controller.page.evaluate("window.__browserLabClientSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_state(controller: Any, expected: Dict[str, Any], label: str, timeout: float = 12.0) -> Dict[str, Any]:
    started = time.monotonic()
    last: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last = await remote_state(controller)
        if all(last.get(key) == value for key, value in expected.items()):
            return last
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last state {last!r}")


def remote_frame(controller: Any) -> Any:
    if not controller.page:
        return None
    for frame in controller.page.frames:
        if frame.url.startswith(f"http://{HOST}:{FRAME_PORT}/frame"):
            return frame
    return None


async def frame_state(controller: Any) -> Dict[str, Any]:
    frame = remote_frame(controller)
    if not frame:
        return {}
    state = await frame.evaluate("window.__browserLabClientFrameSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_frame_state(controller: Any, expected: Dict[str, Any], label: str, timeout: float = 12.0) -> Dict[str, Any]:
    started = time.monotonic()
    last: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last = await frame_state(controller)
        if all(last.get(key) == value for key, value in expected.items()):
            return last
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last frame state {last!r}")


async def canvas_point_for_selector(
    host_page: Any,
    controller: Any,
    selector: str,
    x_fraction: float = 0.5,
    y_fraction: float = 0.5,
) -> tuple[float, float]:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    remote_locator = controller.page.locator(selector)
    await remote_locator.scroll_into_view_if_needed()
    remote_box = await remote_locator.bounding_box()
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not remote_box or not canvas_box:
        raise RuntimeError(f"Could not map selector to canvas: {selector}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    bounded_x = max(0.0, min(1.0, x_fraction))
    bounded_y = max(0.0, min(1.0, y_fraction))
    x = canvas_box["x"] + (remote_box["x"] + remote_box["width"] * bounded_x) * scale_x
    y = canvas_box["y"] + (remote_box["y"] + remote_box["height"] * bounded_y) * scale_y
    return x, y


async def canvas_point_for_frame_selector(
    host_page: Any,
    controller: Any,
    frame_selector: str,
    selector: str,
    x_fraction: float = 0.5,
    y_fraction: float = 0.5,
) -> tuple[float, float]:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    await controller.page.locator(frame_selector).scroll_into_view_if_needed()
    frame = remote_frame(controller)
    if not frame:
        raise RuntimeError("Remote iframe is not available")
    remote_locator = frame.locator(selector)
    await remote_locator.scroll_into_view_if_needed()
    remote_box = await remote_locator.bounding_box()
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not remote_box or not canvas_box:
        raise RuntimeError(f"Could not map frame selector to canvas: {selector}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    bounded_x = max(0.0, min(1.0, x_fraction))
    bounded_y = max(0.0, min(1.0, y_fraction))
    x = canvas_box["x"] + (remote_box["x"] + remote_box["width"] * bounded_x) * scale_x
    y = canvas_box["y"] + (remote_box["y"] + remote_box["height"] * bounded_y) * scale_y
    return x, y


async def click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.click(x, y)
    await host_page.locator("#textSink").focus()
    await asyncio.sleep(0.2)


async def click_remote_frame_selector(host_page: Any, controller: Any, frame_selector: str, selector: str) -> None:
    x, y = await canvas_point_for_frame_selector(host_page, controller, frame_selector, selector)
    await host_page.mouse.click(x, y)
    await host_page.locator("#textSink").focus()
    await asyncio.sleep(0.2)


async def click_remote_selector_at_fraction(host_page: Any, controller: Any, selector: str, x_fraction: float) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector, x_fraction=x_fraction)
    await host_page.mouse.click(x, y)
    await host_page.locator("#textSink").focus()
    await asyncio.sleep(0.2)


async def double_click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.dblclick(x, y)
    await asyncio.sleep(0.2)


async def double_click_remote_selector_at_fraction(
    host_page: Any,
    controller: Any,
    selector: str,
    x_fraction: float,
    y_fraction: float = 0.5,
) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector, x_fraction=x_fraction, y_fraction=y_fraction)
    await host_page.mouse.dblclick(x, y)
    await asyncio.sleep(0.2)


async def double_click_remote_text(
    host_page: Any,
    controller: Any,
    selector: str,
    text: str,
) -> None:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    remote_locator = controller.page.locator(selector)
    await remote_locator.scroll_into_view_if_needed()
    point = await remote_locator.evaluate(
        """
        (el, text) => {
          const doc = el.ownerDocument || document;
          const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const index = String(node.data || '').indexOf(text);
            if (index < 0) continue;
            const range = doc.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + text.length);
            const box = range.getBoundingClientRect();
            if (!box.width || !box.height) continue;
            return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          }
          return null;
        }
        """,
        text,
    )
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not point or not canvas_box:
        raise RuntimeError(f"Could not map text {text!r} in selector to canvas: {selector}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    x = canvas_box["x"] + point["x"] * scale_x
    y = canvas_box["y"] + point["y"] * scale_y
    await host_page.mouse.dblclick(x, y)
    await asyncio.sleep(0.2)


async def right_click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.click(x, y, button="right")
    await asyncio.sleep(0.2)


async def middle_click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.click(x, y, button="middle")
    await asyncio.sleep(0.2)


async def drag_remote_selector(host_page: Any, controller: Any, selector: str, delta_x: int, delta_y: int) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.05)
    await host_page.mouse.down()
    for step in range(1, 5):
        await asyncio.sleep(0.05)
        await host_page.mouse.move(x + delta_x * step / 4, y + delta_y * step / 4)
    await asyncio.sleep(0.05)
    await host_page.mouse.up()
    await asyncio.sleep(0.2)


async def drag_remote_selector_outside_canvas_right(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not canvas_box:
        raise RuntimeError("Browser Lab canvas is not available")
    host_width = await host_page.evaluate("window.innerWidth")
    end_x = min(canvas_box["x"] + canvas_box["width"] + 24, int(host_width) - 8)
    if end_x <= canvas_box["x"] + canvas_box["width"]:
        end_x = canvas_box["x"] + canvas_box["width"] - 2
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.05)
    await host_page.mouse.down()
    for step in range(1, 7):
        await asyncio.sleep(0.05)
        await host_page.mouse.move(x + (end_x - x) * step / 6, y)
    await asyncio.sleep(0.05)
    await host_page.mouse.up()
    await asyncio.sleep(0.2)


async def drag_remote_selector_between_fractions(
    host_page: Any,
    controller: Any,
    selector: str,
    start_fraction: float,
    end_fraction: float,
) -> None:
    start_x, start_y = await canvas_point_for_selector(host_page, controller, selector, x_fraction=start_fraction)
    end_x, end_y = await canvas_point_for_selector(host_page, controller, selector, x_fraction=end_fraction)
    await host_page.mouse.move(start_x, start_y)
    await asyncio.sleep(0.05)
    await host_page.mouse.down()
    for step in range(1, 8):
        t = step / 7
        await asyncio.sleep(0.05)
        await host_page.mouse.move(start_x + (end_x - start_x) * t, start_y + (end_y - start_y) * t)
    await asyncio.sleep(0.05)
    await host_page.mouse.up()
    await asyncio.sleep(0.2)


async def drag_remote_selector_to_selector(host_page: Any, controller: Any, source: str, target: str) -> None:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    source_locator = controller.page.locator(source)
    target_locator = controller.page.locator(target)
    await target_locator.scroll_into_view_if_needed()
    await source_locator.scroll_into_view_if_needed()
    source_box = await source_locator.bounding_box()
    target_box = await target_locator.bounding_box()
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not source_box or not target_box or not canvas_box:
        raise RuntimeError(f"Could not map drag/drop selectors to canvas: {source} -> {target}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    start_x = canvas_box["x"] + (source_box["x"] + source_box["width"] * 0.5) * scale_x
    start_y = canvas_box["y"] + (source_box["y"] + source_box["height"] * 0.5) * scale_y
    end_x = canvas_box["x"] + (target_box["x"] + target_box["width"] * 0.5) * scale_x
    end_y = canvas_box["y"] + (target_box["y"] + target_box["height"] * 0.5) * scale_y
    await host_page.mouse.move(start_x, start_y)
    await asyncio.sleep(0.1)
    await host_page.mouse.down()
    for step in range(1, 11):
        await asyncio.sleep(0.08)
        t = step / 10
        await host_page.mouse.move(start_x + (end_x - start_x) * t, start_y + (end_y - start_y) * t)
    await asyncio.sleep(0.2)
    await host_page.mouse.up()
    await asyncio.sleep(0.5)


async def move_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.15)


async def wheel_remote_selector(host_page: Any, controller: Any, selector: str, delta_y: int) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.05)
    host_target = await host_page.evaluate(
        """
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el ? { id: el.id || '', tag: el.tagName || '', className: String(el.className || '') } : null;
        }
        """,
        {"x": x, "y": y},
    )
    if not host_target or host_target.get("id") not in {"viewportCanvas", "viewportShell"}:
        raise RuntimeError(f"Wheel target is not Browser Lab viewport: {host_target!r} at {(x, y)!r}")
    await host_page.mouse.wheel(0, delta_y)
    await asyncio.sleep(0.2)


async def wheel_canvas_center(host_page: Any, delta_y: int) -> None:
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not canvas_box:
        raise RuntimeError("Browser Lab canvas is not available")
    x = canvas_box["x"] + canvas_box["width"] * 0.5
    y = canvas_box["y"] + canvas_box["height"] * 0.5
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.05)
    await host_page.mouse.wheel(0, delta_y)
    await asyncio.sleep(0.2)


async def remote_selector_visible(controller: Any, selector: str) -> bool:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    return bool(
        await controller.page.locator(selector).evaluate(
            """
            (el) => {
              const box = el.getBoundingClientRect();
              return box.width > 0
                && box.height > 0
                && box.top >= 0
                && box.left >= 0
                && box.bottom <= window.innerHeight
                && box.right <= window.innerWidth;
            }
            """
        )
    )


async def click_visible_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    remote_box = await controller.page.locator(selector).bounding_box()
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not remote_box or not canvas_box:
        raise RuntimeError(f"Could not map visible selector to canvas: {selector}")
    viewport = controller.page.viewport_size
    if not viewport:
        raise RuntimeError("Remote viewport is not available")
    if (
        remote_box["x"] < 0
        or remote_box["y"] < 0
        or remote_box["x"] + remote_box["width"] > viewport["width"]
        or remote_box["y"] + remote_box["height"] > viewport["height"]
    ):
        raise RuntimeError(f"Selector is not visible without page scroll correction: {selector} {remote_box!r}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    x = canvas_box["x"] + (remote_box["x"] + remote_box["width"] * 0.5) * scale_x
    y = canvas_box["y"] + (remote_box["y"] + remote_box["height"] * 0.5) * scale_y
    await host_page.mouse.click(x, y)
    await host_page.locator("#textSink").focus()
    await asyncio.sleep(0.2)


async def touch_drag_remote_selector(host_page: Any, controller: Any, selector: str, delta_x: int, delta_y: int) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.locator("#viewportCanvas").evaluate(
        """
        (canvas, payload) => {
          const makeTouch = (x, y) => ({
            identifier: 7,
            target: canvas,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
            screenX: x,
            screenY: y,
            radiusX: 1,
            radiusY: 1,
            force: 1,
          });
          const dispatch = (type, touches, changedTouches) => {
            const ev = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(ev, 'touches', { value: touches });
            Object.defineProperty(ev, 'targetTouches', { value: touches });
            Object.defineProperty(ev, 'changedTouches', { value: changedTouches });
            canvas.dispatchEvent(ev);
          };
          const start = makeTouch(payload.x, payload.y);
          const mid = makeTouch(payload.x + payload.deltaX * 0.5, payload.y + payload.deltaY * 0.5);
          const end = makeTouch(payload.x + payload.deltaX, payload.y + payload.deltaY);
          dispatch('touchstart', [start], [start]);
          dispatch('touchmove', [mid], [mid]);
          dispatch('touchmove', [end], [end]);
          dispatch('touchend', [], [end]);
        }
        """,
        {"x": x, "y": y, "deltaX": delta_x, "deltaY": delta_y},
    )
    await asyncio.sleep(0.3)


async def multi_touch_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.locator("#viewportCanvas").evaluate(
        """
        (canvas, payload) => {
          const makeTouch = (identifier, x, y) => ({
            identifier,
            target: canvas,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
            screenX: x,
            screenY: y,
            radiusX: 1,
            radiusY: 1,
            force: 1,
          });
          const dispatch = (type, touches, changedTouches) => {
            const ev = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(ev, 'touches', { value: touches });
            Object.defineProperty(ev, 'targetTouches', { value: touches });
            Object.defineProperty(ev, 'changedTouches', { value: changedTouches });
            canvas.dispatchEvent(ev);
          };
          const startA = makeTouch(11, payload.x - 30, payload.y);
          const startB = makeTouch(12, payload.x + 30, payload.y);
          const moveA = makeTouch(11, payload.x - 75, payload.y);
          const moveB = makeTouch(12, payload.x + 75, payload.y);
          dispatch('touchstart', [startA, startB], [startA, startB]);
          dispatch('touchmove', [moveA, moveB], [moveA, moveB]);
          dispatch('touchend', [], [moveA, moveB]);
        }
        """,
        {"x": x, "y": y},
    )
    await asyncio.sleep(0.3)


async def drop_file_remote_selector(host_page: Any, controller: Any, selector: str, path: Path) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    payload = {
        "name": path.name,
        "text": path.read_text(encoding="utf-8"),
    }
    data_transfer = await host_page.evaluate_handle(
        """
        ({ name, text }) => {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(new File([text], name, { type: 'text/plain' }));
          return dataTransfer;
        }
        """,
        payload,
    )
    try:
        await host_page.locator("#viewportCanvas").dispatch_event(
            "dragover",
            {"clientX": x, "clientY": y, "dataTransfer": data_transfer},
        )
        await host_page.locator("#viewportCanvas").dispatch_event(
            "drop",
            {"clientX": x, "clientY": y, "dataTransfer": data_transfer},
        )
    finally:
        await data_transfer.dispose()
    await asyncio.sleep(0.3)


async def assert_remote_focus(controller: Any, expected_id: str) -> None:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    active_id = await controller.page.evaluate("document.activeElement && document.activeElement.id")
    if active_id != expected_id:
        raise AssertionError(f"Expected remote focus on #{expected_id}, got #{active_id}")


async def wait_for_remote_deep_focus(controller: Any, expected_id: str, timeout: float = 10.0) -> None:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    started = time.monotonic()
    last = ""
    while time.monotonic() - started < timeout:
        last = await controller.page.evaluate(
            """
            () => {
              let el = document.activeElement;
              while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                el = el.shadowRoot.activeElement;
              }
              return el && el.id || '';
            }
            """
        )
        if last == expected_id:
            return
        await asyncio.sleep(0.1)
    raise AssertionError(f"Expected remote deep focus on #{expected_id}, got #{last!r}")


async def run_smoke() -> None:
    configure_runtime()

    # Import after env setup so BrowserLab picks up /tmp-only test paths.
    from server import app, controller  # pylint: disable=import-error,import-outside-toplevel

    static_handler = partial(QuietStaticHandler, directory=str(STATIC_DIR))
    static_server = ThreadingHTTPServer((HOST, STATIC_PORT), static_handler)
    fixture_server = ThreadingHTTPServer((HOST, FIXTURE_PORT), FixtureHandler)
    frame_server = ThreadingHTTPServer((HOST, FRAME_PORT), FrameHandler)
    start_http_server(static_server)
    start_http_server(fixture_server)
    start_http_server(frame_server)

    config = uvicorn.Config(app, host=HOST, port=PROXY_PORT, log_level="warning")
    proxy_server = uvicorn.Server(config)
    proxy_task = asyncio.create_task(proxy_server.serve())

    try:
        await asyncio.sleep(0.5)
        async with async_playwright() as playwright:
            host_browser = await playwright.chromium.launch(headless=True)
            host_context = await host_browser.new_context(viewport={"width": 1600, "height": 1100}, has_touch=True)
            await host_context.grant_permissions(
                ["clipboard-read", "clipboard-write"],
                origin=f"http://{HOST}:{STATIC_PORT}",
            )
            host_page = await host_context.new_page()
            await host_page.goto(
                f"http://{HOST}:{STATIC_PORT}/browser_lab.html?proxy=http://{HOST}:{PROXY_PORT}",
                wait_until="domcontentloaded",
            )
            await host_page.locator("#connectionStatus").wait_for(timeout=20_000)
            async def client_connected() -> bool:
                profile_text = await host_page.locator("#profilePath").inner_text()
                return (
                    await host_page.locator("#connectionStatus").inner_text() == "Connected"
                    and profile_text not in {"", "-"}
                    and controller.page is not None
                )

            await wait_for(
                client_connected,
                "Browser Lab client connection",
                timeout=25,
            )
            await host_page.locator("#scaleSelect").select_option("1")
            await host_page.locator("#viewportWidth").fill("900")
            await host_page.locator("#viewportHeight").fill("760")
            await host_page.locator("#applyStreamBtn").click()

            async def remote_viewport_resized() -> bool:
                if not controller.page:
                    return False
                size = await controller.page.evaluate("({ width: window.innerWidth, height: window.innerHeight })")
                return size == {"width": 900, "height": 760}

            await wait_for(remote_viewport_resized, "Remote viewport resized from static client", timeout=15)
            await host_page.locator("#addressInput").fill(f"http://{HOST}:{FIXTURE_PORT}/")
            await host_page.locator("#addressInput").press("Enter")

            async def remote_fixture_loaded() -> bool:
                return bool(controller.page and controller.page.url.startswith(f"http://{HOST}:{FIXTURE_PORT}"))

            await wait_for(
                remote_fixture_loaded,
                "Remote React fixture navigation",
                timeout=35,
            )
            if not controller.page:
                raise RuntimeError("Remote browser page is not available")
            await controller.page.locator("#name").wait_for(state="visible", timeout=20_000)
            await wait_for(
                lambda: host_page.locator("#viewportCanvas").evaluate(
                    "(canvas) => canvas.width === 900 && canvas.height === 760"
                ),
                "Browser Lab canvas resized",
                timeout=15,
            )
            await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()

            bridge_ready = await controller.page.evaluate(
                "Boolean(window.__browserLabHistoryStatusBridgeInstalled && typeof window.__browserLabStatusChanged === 'function')"
            )
            if not bridge_ready:
                raise AssertionError("Browser Lab history status bridge was not installed in the remote React page")

            await click_remote_selector(host_page, controller, "#spaDetailLink")
            await wait_for_state(
                controller,
                {"route": "/spa/detail", "routeDetailSeen": True},
                "client canvas React SPA pushState route",
            )

            last_spa_status: Dict[str, str] = {}

            async def client_url_contains_detail() -> bool:
                current_url = await host_page.locator("#currentUrl").inner_text()
                nav_state = await host_page.locator("#navState").inner_text()
                last_spa_status["current_url"] = current_url
                last_spa_status["nav_state"] = nav_state
                return "/spa/detail?from=client#section" in current_url and "spa pushState" in nav_state

            try:
                await wait_for(
                    client_url_contains_detail,
                    "Browser Lab status follows React SPA pushState URL/nav state",
                    timeout=15,
                )
            except TimeoutError as exc:
                raise TimeoutError(f"{exc}; last status {last_spa_status!r}") from exc
            await host_page.locator("#backBtn").click()
            await wait_for_state(
                controller,
                {"route": "/", "routeHomeReturned": True},
                "client Browser Lab Back triggers React popstate",
            )

            await click_remote_selector(host_page, controller, "#spaReplaceLink")
            await wait_for_state(
                controller,
                {"routeReplaceSeen": True},
                "client canvas React SPA replaceState route",
            )

            async def client_url_contains_replace() -> bool:
                current_url = await host_page.locator("#currentUrl").inner_text()
                nav_state = await host_page.locator("#navState").inner_text()
                return "/?replace=done" in current_url and "spa replaceState" in nav_state

            await wait_for(
                client_url_contains_replace,
                "Browser Lab status follows React SPA replaceState URL/nav state",
                timeout=15,
            )

            await click_remote_selector(host_page, controller, "#spaHashLink")
            await wait_for_state(
                controller,
                {"routeHashSeen": True, "routeOk": True},
                "client canvas React SPA hashchange route",
            )

            async def client_url_contains_hash() -> bool:
                current_url = await host_page.locator("#currentUrl").inner_text()
                nav_state = await host_page.locator("#navState").inner_text()
                return "#hash-route" in current_url and "spa hashchange" in nav_state

            await wait_for(
                client_url_contains_hash,
                "Browser Lab status follows React SPA hashchange URL/nav state",
                timeout=15,
            )

            await click_remote_selector(host_page, controller, "#name")
            await host_page.keyboard.press("Control+K")
            await wait_for_state(
                controller,
                {"paletteOpen": True, "shortcutCount": 1},
                "client canvas React global Ctrl+K shortcut",
            )
            await host_page.keyboard.press("Escape")
            await wait_for_state(
                controller,
                {"shortcutOk": True},
                "client canvas React global Escape shortcut",
            )
            await click_remote_selector(host_page, controller, "#name")
            await host_page.keyboard.press("Control+Alt+L")
            await wait_for_state(
                controller,
                {"codeShortcutOk": True},
                "client canvas React global event.code shortcut",
            )

            await click_remote_selector(host_page, controller, "#name")
            await assert_remote_focus(controller, "name")
            await host_page.keyboard.type("react")
            await wait_for_state(controller, {"name": "react", "beforeInputOk": True}, "client text sink ASCII beforeinput")
            await host_page.keyboard.press("Control+A")
            await host_page.locator("#copyBtn").click()

            async def clipboard_contains_react() -> bool:
                try:
                    return await host_page.evaluate("navigator.clipboard.readText()") == "react"
                except Exception:
                    return False

            await wait_for(clipboard_contains_react, "client copy button copies selected remote React input", timeout=10)

            await click_remote_selector(host_page, controller, "#alias")
            await assert_remote_focus(controller, "alias")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.keyboard.type("\uD55C\uAE00")
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await wait_for_state(
                controller,
                {"alias": "\uD55C\uAE00", "compositionOk": True},
                "client text sink non-ASCII composition input",
            )

            await click_remote_selector(host_page, controller, "#notes")
            await assert_remote_focus(controller, "notes")
            await host_page.keyboard.type("multi")
            await host_page.keyboard.press("Enter")
            await host_page.keyboard.type("line")
            await wait_for_state(controller, {"notes": "multi\nline"}, "client textarea Enter input")

            await click_remote_selector(host_page, controller, "#spaceText")
            await assert_remote_focus(controller, "spaceText")
            await host_page.keyboard.type("hello world")
            await wait_for_state(controller, {"spaceText": "hello world"}, "client controlled input Space text insertion")
            await click_remote_selector(host_page, controller, "#spaceSwitch")
            await assert_remote_focus(controller, "spaceSwitch")
            await host_page.keyboard.press("Space")
            await wait_for_state(controller, {"spaceOk": True}, "client React custom switch Space activation")

            await click_remote_selector(host_page, controller, "#editBackspace")
            await assert_remote_focus(controller, "editBackspace")
            await host_page.keyboard.type("keepx")
            await host_page.keyboard.press("Backspace")
            await wait_for_state(controller, {"editBackspace": "keep"}, "client controlled input Backspace editing")

            await click_remote_selector(host_page, controller, "#editReplace")
            await assert_remote_focus(controller, "editReplace")
            await host_page.keyboard.type("bad")
            await host_page.keyboard.press("Control+A")
            await host_page.keyboard.type("done")
            await wait_for_state(controller, {"editReplace": "done"}, "client controlled input Ctrl+A replacement")

            await click_remote_selector(host_page, controller, "#selectionReplace")
            await assert_remote_focus(controller, "selectionReplace")
            await host_page.keyboard.type("abcdef")
            await host_page.keyboard.down("Shift")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.up("Shift")
            await host_page.keyboard.type("XYZ")
            await wait_for_state(
                controller,
                {"selectionReplaceOk": True},
                "client controlled input Shift+Arrow partial selection replacement",
            )

            await click_remote_selector(host_page, controller, "#selectionDelete")
            await assert_remote_focus(controller, "selectionDelete")
            await host_page.keyboard.type("abcdef")
            await host_page.keyboard.down("Shift")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.up("Shift")
            await host_page.keyboard.press("Backspace")
            await wait_for_state(
                controller,
                {"selectionDeleteOk": True},
                "client controlled input Shift+Arrow selected-range Backspace deletion",
            )

            await click_remote_selector(host_page, controller, "#mouseSelectionReplace")
            await assert_remote_focus(controller, "mouseSelectionReplace")
            await host_page.keyboard.type("dragselect")
            await drag_remote_selector_between_fractions(host_page, controller, "#mouseSelectionReplace", 0.06, 0.96)
            await host_page.locator("#textSink").focus()
            await host_page.keyboard.type("mouse")
            await wait_for_state(
                controller,
                {"mouseSelectionReplaceOk": True},
                "client controlled input mouse-drag selection replacement",
            )

            await click_remote_selector(host_page, controller, "#doubleSelectionReplace")
            await assert_remote_focus(controller, "doubleSelectionReplace")
            await host_page.keyboard.type("hello world")
            await wait_for_state(
                controller,
                {"doubleSelectionReplace": "hello world"},
                "client controlled input double-click probe initial text",
            )
            await double_click_remote_selector_at_fraction(host_page, controller, "#doubleSelectionReplace", 0.74)
            await host_page.locator("#textSink").focus()
            await host_page.keyboard.type("there")
            await wait_for_state(
                controller,
                {"doubleSelectionReplaceOk": True},
                "client controlled input double-click word selection replacement",
            )

            await click_remote_selector(host_page, controller, "#editDelete")
            await assert_remote_focus(controller, "editDelete")
            await host_page.keyboard.type("delx")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("Delete")
            await wait_for_state(controller, {"editDelete": "del", "editOk": True}, "client controlled input Delete editing")

            await click_remote_selector(host_page, controller, "#enterSubmit")
            await assert_remote_focus(controller, "enterSubmit")
            await host_page.keyboard.type("enter")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"enterSubmitOk": True}, "client controlled input Enter form submit")

            await click_remote_selector(host_page, controller, "#ctrlEnter")
            await assert_remote_focus(controller, "ctrlEnter")
            await host_page.keyboard.type("send")
            await host_page.keyboard.down("Control")
            await host_page.keyboard.press("Enter")
            await host_page.keyboard.up("Control")
            await wait_for_state(controller, {"ctrlEnterOk": True}, "client React textarea Ctrl+Enter shortcut")

            await click_remote_selector(host_page, controller, "#shiftEnter")
            await assert_remote_focus(controller, "shiftEnter")
            await host_page.keyboard.type("soft")
            await host_page.keyboard.down("Shift")
            await host_page.keyboard.press("Enter")
            await host_page.keyboard.up("Shift")
            await host_page.keyboard.type("line")
            await wait_for_state(controller, {"shiftEnterOk": True}, "client React textarea Shift+Enter soft newline")

            await click_remote_selector(host_page, controller, "#focusBlur")
            await assert_remote_focus(controller, "focusBlur")
            await host_page.keyboard.type("focus")
            await click_remote_selector(host_page, controller, "#debounced")
            await wait_for_state(controller, {"focusBlurOk": True}, "client controlled input focus and blur")

            await click_remote_selector(host_page, controller, "#relatedFirst")
            await assert_remote_focus(controller, "relatedFirst")
            await host_page.keyboard.type("rel")
            await click_remote_selector(host_page, controller, "#relatedSecond")
            await assert_remote_focus(controller, "relatedSecond")
            await host_page.keyboard.type("target")
            await wait_for_state(controller, {"relatedBlurOk": True}, "client React onBlur relatedTarget focus transfer")

            await click_remote_selector(host_page, controller, "#debounced")
            await assert_remote_focus(controller, "debounced")
            await host_page.keyboard.type("query")
            await wait_for_state(controller, {"debounceOk": True}, "client controlled input debounced async state")

            await click_remote_selector(host_page, controller, "#validationSubmitButton")
            await wait_for_state(
                controller,
                {"invalidCount": 1, "validationSubmitCount": 0},
                "client React required input onInvalid blocks submit",
            )
            await click_remote_selector(host_page, controller, "#validationProbe")
            await assert_remote_focus(controller, "validationProbe")
            await host_page.keyboard.type("valid")
            await click_remote_selector(host_page, controller, "#validationSubmitButton")
            await wait_for_state(controller, {"validationOk": True}, "client React constraint validation submit")

            await click_remote_selector(host_page, controller, "#passwordProbe")
            await assert_remote_focus(controller, "passwordProbe")
            await host_page.keyboard.type("secret")
            await wait_for_state(controller, {"passwordText": "secret"}, "client React password input")

            await click_remote_selector(host_page, controller, "#numberProbe")
            await assert_remote_focus(controller, "numberProbe")
            await host_page.keyboard.type("42")
            await wait_for_state(controller, {"numberText": "42"}, "client React number input")

            await click_remote_selector(host_page, controller, "#searchProbe")
            await assert_remote_focus(controller, "searchProbe")
            await host_page.keyboard.type("find")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"searchText": "find", "searchSubmitCount": 1}, "client React search input submit")

            await click_remote_selector(host_page, controller, "#labelFocusLabel")
            await assert_remote_focus(controller, "labelFocusTarget")
            await host_page.keyboard.type("label")
            await wait_for_state(controller, {"specialInputOk": True}, "client React special input types and label focus")

            await click_remote_selector(host_page, controller, "#emailProbe")
            await assert_remote_focus(controller, "emailProbe")
            await host_page.keyboard.type("user@example.test")
            await wait_for_state(controller, {"emailText": "user@example.test"}, "client React email input value")
            await host_page.keyboard.press("Tab")
            await wait_for_remote_deep_focus(controller, "telProbe")
            await host_page.keyboard.type("5550100")
            await wait_for_state(controller, {"telText": "5550100"}, "client React tel input value")
            await host_page.keyboard.press("Tab")
            await wait_for_remote_deep_focus(controller, "urlProbe")
            await click_remote_selector(host_page, controller, "#urlProbe")
            await assert_remote_focus(controller, "urlProbe")
            await host_page.keyboard.type("https://example.test")
            await wait_for_state(controller, {"contactInputOk": True}, "client React email/tel/url input types")

            await click_remote_selector(host_page, controller, "#dateProbe")
            await assert_remote_focus(controller, "dateProbe")
            await host_page.keyboard.type("2026-05-02")
            await wait_for_state(controller, {"dateText": "2026-05-02"}, "client React date input value")
            await click_remote_selector(host_page, controller, "#timeProbe")
            await assert_remote_focus(controller, "timeProbe")
            await host_page.keyboard.type("13:45")
            await wait_for_state(controller, {"timeText": "13:45"}, "client React time input value")
            await click_remote_selector(host_page, controller, "#datetimeLocalProbe")
            await assert_remote_focus(controller, "datetimeLocalProbe")
            await host_page.keyboard.type("2026-05-02T13:45")
            await wait_for_state(controller, {"datetimeLocalText": "2026-05-02T13:45"}, "client React datetime-local input value")
            await click_remote_selector(host_page, controller, "#monthProbe")
            await assert_remote_focus(controller, "monthProbe")
            await host_page.keyboard.type("2026-05")
            await wait_for_state(controller, {"monthText": "2026-05"}, "client React month input value")
            await click_remote_selector(host_page, controller, "#weekProbe")
            await assert_remote_focus(controller, "weekProbe")
            await host_page.keyboard.type("2026-W18")
            await wait_for_state(controller, {"weekText": "2026-W18"}, "client React week input value")
            await click_remote_selector(host_page, controller, "#colorProbe")
            await assert_remote_focus(controller, "colorProbe")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "#336699")
            await host_page.locator("#pasteBtn").click()
            await wait_for_state(controller, {"dateTimeOk": True}, "client React date/time/month/week/color input types")

            await click_remote_selector(host_page, controller, "#fileProbe")
            await host_page.locator("#uploadInput").set_input_files(str(UPLOAD_PATH))
            await wait_for_state(controller, {"fileInputOk": True}, "client React file input upload bridge")
            await drop_file_remote_selector(host_page, controller, "#fileDropZone", DROP_PATH)
            await wait_for_state(controller, {"fileDropOk": True}, "client React file drop DataTransfer bridge")

            await click_remote_selector(host_page, controller, "#inputEvent")
            await assert_remote_focus(controller, "inputEvent")
            await host_page.keyboard.type("input")
            await wait_for_state(controller, {"inputEventOk": True}, "client React onInput controlled state")

            await click_remote_selector(host_page, controller, "#keyUpProbe")
            await assert_remote_focus(controller, "keyUpProbe")
            await host_page.keyboard.type("keyup")
            await wait_for_state(controller, {"keyUpOk": True}, "client React onKeyUp from text sink typing")

            await click_remote_selector(host_page, controller, "#inputTypeProbe")
            await assert_remote_focus(controller, "inputTypeProbe")
            await host_page.keyboard.type("ab")
            await host_page.keyboard.press("Backspace")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "XY")
            await host_page.locator("#pasteBtn").click()
            await wait_for_state(controller, {"inputTypeOk": True}, "client React input event inputType for type/delete/paste")

            await click_remote_selector(host_page, controller, "#trustedInput")
            await assert_remote_focus(controller, "trustedInput")
            await host_page.keyboard.type("t")
            await wait_for_state(controller, {"trustedText": "t"}, "client React trusted keyboard input text")
            await click_remote_selector(host_page, controller, "#trustedButton")
            await wait_for_state(controller, {"trustedOk": True}, "client React nativeEvent.isTrusted for key/input/pointer/click")
            await click_remote_selector(host_page, controller, "#eventOrderButton")
            await wait_for_state(controller, {"eventOrderOk": True}, "client React pointer/mouse/focus/click event order")

            await click_remote_selector(host_page, controller, "#beforeMask")
            await assert_remote_focus(controller, "beforeMask")
            await host_page.keyboard.type("mask")
            await wait_for_state(controller, {"beforeMaskOk": True}, "client React beforeinput preventDefault mask")

            await click_remote_selector(host_page, controller, "#undoProbe")
            await assert_remote_focus(controller, "undoProbe")
            await host_page.keyboard.type("undo")
            await wait_for_state(controller, {"undoProbe": "undo"}, "client React undo probe input")
            await host_page.keyboard.press("Control+Z")
            await wait_for_state(
                controller,
                {"undoProbe": "", "undoVisitedEmpty": True},
                "client Ctrl+Z React controlled input undo",
            )
            await host_page.keyboard.press("Control+Y")
            await wait_for_state(controller, {"undoOk": True}, "client Ctrl+Y React controlled input redo")

            await click_remote_selector(host_page, controller, "#resetProbe")
            await assert_remote_focus(controller, "resetProbe")
            await host_page.keyboard.type("resetme")
            await wait_for_state(controller, {"resetProbe": "resetme"}, "client React reset probe input")
            await click_remote_selector(host_page, controller, "#resetButton")
            await wait_for_state(controller, {"resetOk": True}, "client React form onReset controlled state reset")

            await click_remote_selector(host_page, controller, "#copyProbe")
            await assert_remote_focus(controller, "copyProbe")
            await host_page.keyboard.type("copyme")
            await wait_for_state(controller, {"copyProbe": "copyme"}, "client React copy probe input")
            await host_page.keyboard.press("Control+A")
            await host_page.keyboard.press("Control+C")

            async def clipboard_contains_copyme() -> bool:
                try:
                    return await host_page.evaluate("navigator.clipboard.readText()") == "copyme"
                except Exception:
                    return False

            await wait_for(clipboard_contains_copyme, "client Ctrl+C bridges selected remote React input to host clipboard", timeout=10)
            await wait_for_state(controller, {"copyOk": True}, "client Ctrl+C React onCopy and host clipboard bridge")
            await host_page.keyboard.press("End")
            await host_page.keyboard.down("Shift")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.up("Shift")
            await host_page.keyboard.press("Control+C")

            async def clipboard_contains_me() -> bool:
                try:
                    return await host_page.evaluate("navigator.clipboard.readText()") == "me"
                except Exception:
                    return False

            await wait_for(
                clipboard_contains_me,
                "client Shift+Arrow partial selection copy bridges selected remote React text",
                timeout=10,
            )
            await wait_for_state(
                controller,
                {"partialCopyOk": True},
                "client Shift+Arrow partial selection React onCopy and host clipboard bridge",
            )

            await click_remote_selector(host_page, controller, "#cutProbe")
            await assert_remote_focus(controller, "cutProbe")
            await host_page.keyboard.type("cutme")
            await wait_for_state(controller, {"cutProbe": "cutme"}, "client React cut probe input")
            await host_page.keyboard.press("Control+A")
            await host_page.keyboard.press("Control+X")

            async def clipboard_contains_cutme() -> bool:
                try:
                    return await host_page.evaluate("navigator.clipboard.readText()") == "cutme"
                except Exception:
                    return False

            await wait_for(clipboard_contains_cutme, "client Ctrl+X bridges selected remote React input to host clipboard", timeout=10)
            await wait_for_state(controller, {"cutOk": True}, "client Ctrl+X React onCut and state deletion")

            await click_remote_selector(host_page, controller, "#comboInput")
            await assert_remote_focus(controller, "comboInput")
            await host_page.keyboard.type("be")
            await wait_for_state(controller, {"comboQuery": "be", "comboOpen": True}, "client React combobox filtering")
            await click_remote_selector(host_page, controller, "#comboOptionBeta")
            await wait_for_state(controller, {"comboOk": True}, "client React combobox mousedown option selection")

            await click_remote_selector(host_page, controller, "#keyboardComboInput")
            await assert_remote_focus(controller, "keyboardComboInput")
            await host_page.keyboard.type("a")
            await wait_for_state(
                controller,
                {"keyboardComboQuery": "a", "keyboardComboOpen": True},
                "client React keyboard combobox filtering",
            )
            await host_page.keyboard.press("ArrowDown")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"keyboardComboOk": True}, "client React aria-activedescendant keyboard combobox")

            await click_remote_selector(host_page, controller, "#rovingMenuTrigger")
            await wait_for_state(controller, {"rovingMenuOpen": True, "rovingMenuActive": 0}, "client React roving menu opened")
            await wait_for_remote_deep_focus(controller, "rovingMenuItemNew")
            await host_page.keyboard.press("ArrowDown")
            await wait_for_remote_deep_focus(controller, "rovingMenuItemExport")
            await host_page.keyboard.press("End")
            await wait_for_remote_deep_focus(controller, "rovingMenuItemArchive")
            await host_page.keyboard.press("ArrowUp")
            await wait_for_remote_deep_focus(controller, "rovingMenuItemExport")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"rovingMenuOk": True}, "client React roving tabindex menu keyboard selection")

            await click_remote_selector(host_page, controller, "#capturePhaseInput")
            await assert_remote_focus(controller, "capturePhaseInput")
            await host_page.keyboard.type("cap")
            await click_remote_selector(host_page, controller, "#capturePhaseButton")
            await wait_for_state(controller, {"captureOk": True}, "client React capture-phase key/pointer/click events")

            await click_remote_selector(host_page, controller, "#pasteProbe")
            await assert_remote_focus(controller, "pasteProbe")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "clip")
            await host_page.locator("#pasteBtn").click()
            await wait_for_state(controller, {"pasteOk": True}, "client paste button React onPaste")

            await click_remote_selector(host_page, controller, "#pasteShortcutProbe")
            await assert_remote_focus(controller, "pasteShortcutProbe")
            await host_page.keyboard.type("abcDEF")
            await host_page.keyboard.down("Shift")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.up("Shift")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "XYZ")
            await host_page.keyboard.press("Control+V")
            await wait_for_state(controller, {"pasteShortcutOk": True}, "client Ctrl+V React selected-range onPaste replacement")

            await click_remote_selector(host_page, controller, "#pasteDataProbe")
            await assert_remote_focus(controller, "pasteDataProbe")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "clipdata")
            await host_page.locator("#pasteBtn").click()
            await wait_for_state(controller, {"pasteDataOk": True}, "client React onPaste clipboardData payload")

            await click_remote_selector(host_page, controller, "#agree")
            await wait_for_state(controller, {"checked": True}, "client canvas React checkbox")

            await click_remote_selector(host_page, controller, "#choice")
            await host_page.keyboard.press("ArrowDown")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"choice": "b"}, "client canvas React select")

            await click_remote_selector(host_page, controller, "#speedFast")
            await wait_for_state(controller, {"speed": "fast"}, "client canvas React radio")

            await host_page.keyboard.press("Tab")
            await wait_for_remote_deep_focus(controller, "keyboardNativeCheck")
            await host_page.keyboard.press("Space")
            await wait_for_state(controller, {"keyboardNativeChecked": True}, "client keyboard Space toggles React checkbox")
            await host_page.keyboard.press("Tab")
            await wait_for_remote_deep_focus(controller, "keyboardNativeRadioLeft")
            await host_page.keyboard.press("ArrowRight")
            await wait_for_state(controller, {"keyboardNativeOk": True}, "client keyboard ArrowRight changes React radio")
            await host_page.keyboard.press("Tab")
            await wait_for_remote_deep_focus(controller, "keyboardRangeProbe")
            await host_page.keyboard.press("End")
            await wait_for_state(controller, {"keyboardRangeOk": True}, "client keyboard End changes React range")

            await click_remote_selector_at_fraction(host_page, controller, "#rangeProbe", 0.92)
            await wait_for_state(controller, {"rangeOk": True}, "client canvas React range input")

            await click_remote_selector_at_fraction(host_page, controller, "#dragRangeProbe", 0.1)
            await drag_remote_selector_between_fractions(host_page, controller, "#dragRangeProbe", 0.1, 0.95)
            await wait_for_state(controller, {"dragRangeOk": True}, "client canvas React range input drag")

            await click_remote_selector(host_page, controller, "#rich")
            await assert_remote_focus(controller, "rich")
            await host_page.keyboard.type("notes")
            await wait_for_state(controller, {"rich": "notes", "controlsOk": True}, "client canvas React contenteditable")

            await click_remote_selector(host_page, controller, "#richClipboard")
            await assert_remote_focus(controller, "richClipboard")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "richclip")
            await host_page.keyboard.press("Control+V")
            await wait_for_state(
                controller,
                {"richClipboard": "richclip", "richPasteCount": 1},
                "client Ctrl+V React contenteditable onPaste",
            )
            await host_page.keyboard.press("Control+A")
            await host_page.keyboard.press("Control+X")

            async def clipboard_contains_richclip() -> bool:
                try:
                    return await host_page.evaluate("navigator.clipboard.readText()") == "richclip"
                except Exception:
                    return False

            await wait_for(
                clipboard_contains_richclip,
                "client Ctrl+X bridges selected React contenteditable text to host clipboard",
                timeout=10,
            )
            await wait_for_state(
                controller,
                {"richClipboardOk": True},
                "client Ctrl+X React contenteditable onCut and state deletion",
            )

            await click_remote_selector(host_page, controller, "#richIme")
            await assert_remote_focus(controller, "richIme")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.keyboard.type("\uD55C\uAE00")
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await wait_for_state(controller, {"richImeOk": True}, "client React contenteditable IME composition")

            await click_remote_selector(host_page, controller, "#richReplace")
            await assert_remote_focus(controller, "richReplace")
            await host_page.keyboard.type("abcdef")
            await host_page.keyboard.down("Shift")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.press("ArrowLeft")
            await host_page.keyboard.up("Shift")
            await host_page.keyboard.type("XYZ")
            await wait_for_state(controller, {"richReplaceOk": True}, "client React contenteditable selected-range replacement")

            await click_remote_selector(host_page, controller, "#richMouseReplace")
            await assert_remote_focus(controller, "richMouseReplace")
            await host_page.keyboard.type("dragselect")
            await drag_remote_selector_between_fractions(host_page, controller, "#richMouseReplace", 0.06, 0.96)
            await host_page.locator("#textSink").focus()
            await host_page.keyboard.type("mouse")
            await wait_for_state(
                controller,
                {"richMouseReplaceOk": True},
                "client React contenteditable mouse-drag selection replacement",
            )

            await click_remote_selector(host_page, controller, "#richDoubleReplace")
            await assert_remote_focus(controller, "richDoubleReplace")
            await host_page.keyboard.type("hello world")
            await wait_for_state(
                controller,
                {"richDoubleReplace": "hello world"},
                "client React contenteditable double-click probe initial text",
            )
            await double_click_remote_text(host_page, controller, "#richDoubleReplace", "world")
            await host_page.locator("#textSink").focus()
            await host_page.keyboard.type("there")
            await wait_for_state(
                controller,
                {"richDoubleReplaceOk": True},
                "client React contenteditable double-click word selection replacement",
            )

            await click_remote_selector(host_page, controller, "#portalInput")
            await assert_remote_focus(controller, "portalInput")
            await host_page.keyboard.type("portal")
            await click_remote_selector(host_page, controller, "#portalButton")
            await wait_for_state(controller, {"portalOk": True}, "client canvas React portal input and click")

            await click_remote_selector(host_page, controller, "#portalMenuTrigger")
            await wait_for_state(controller, {"portalMenuOpen": True}, "client React portal menu opened")
            await wait_for_remote_deep_focus(controller, "portalMenuItemSave")
            await click_remote_selector(host_page, controller, "#portalMenuItemSave")
            await wait_for_state(controller, {"portalMenuChoice": "Save", "portalMenuOpen": False}, "client React portal menu item click")
            await click_remote_selector(host_page, controller, "#portalMenuTrigger")
            await wait_for_state(controller, {"portalMenuOpen": True}, "client React portal menu reopened for Escape")
            await host_page.keyboard.press("Escape")
            await wait_for_state(controller, {"portalMenuEscape": 1, "portalMenuOpen": False}, "client React portal menu Escape close")
            await click_remote_selector(host_page, controller, "#portalMenuTrigger")
            await wait_for_state(controller, {"portalMenuOpen": True}, "client React portal menu reopened for outside click")
            await wait_for_remote_deep_focus(controller, "portalMenuItemSave")
            await click_remote_selector(host_page, controller, "#name")
            await wait_for_state(controller, {"portalMenuOk": True}, "client React portal menu outside pointerdown close")

            await click_remote_selector(host_page, controller, "#portalTrapTrigger")
            await wait_for_state(controller, {"portalTrapOpen": True}, "client React portal focus trap opened")
            await wait_for_remote_deep_focus(controller, "portalTrapFirst")
            await host_page.keyboard.type("trap")
            await wait_for_state(controller, {"portalTrapText": "trap"}, "client React portal trap input text")
            await host_page.keyboard.press("Tab")
            await wait_for_remote_deep_focus(controller, "portalTrapSecond")
            await host_page.keyboard.press("Shift+Tab")
            await wait_for_remote_deep_focus(controller, "portalTrapFirst")
            await wait_for_state(controller, {"portalTrapOk": True}, "client React portal focus trap Tab and Shift+Tab")

            await drag_remote_selector(host_page, controller, "#drawCanvas", 110, 24)
            await wait_for_state(controller, {"canvasDrawOk": True}, "client React canvas pointer coordinate mapping")

            await drag_remote_selector(host_page, controller, "#svgBoard", 110, 26)
            await wait_for_state(controller, {"svgPointerOk": True}, "client React SVG pointer coordinate mapping")

            await drag_remote_selector(host_page, controller, "#pointerPad", 140, 0)
            for _attempt in range(3):
                await wheel_remote_selector(host_page, controller, "#pointerPad", 120)
                pointer_state = await remote_state(controller)
                pointer = pointer_state.get("pointer") if isinstance(pointer_state, dict) else {}
                if isinstance(pointer, dict) and pointer.get("wheel", 0) >= 1:
                    break
            await wait_for_state(controller, {"pointerOk": True}, "client canvas React pointer drag and wheel")
            await wait_for_state(controller, {"pointerButtonOk": True}, "client canvas React pointer button/buttons state")
            await wait_for_state(controller, {"pointerMetaOk": True}, "client canvas React pointer id/type/isPrimary metadata")

            await touch_drag_remote_selector(host_page, controller, "#touchPad", 120, 0)
            await wait_for_state(controller, {"touchOk": True}, "client canvas React touch drag")
            await multi_touch_remote_selector(host_page, controller, "#multiTouchPad")
            await wait_for_state(controller, {"multiTouchOk": True}, "client canvas React multi-touch gesture payload")
            await drag_remote_selector_outside_canvas_right(host_page, controller, "#edgeDragPad")
            await wait_for_state(controller, {"edgeDragOk": True}, "client canvas React drag continues outside Browser Lab canvas")

            await drag_remote_selector(host_page, controller, "#capturePad", 170, 0)
            await wait_for_state(controller, {"pointerCaptureOk": True}, "client canvas React pointer capture drag")

            await move_remote_selector(host_page, controller, "#hoverPad")
            await move_remote_selector(host_page, controller, "#name")
            await wait_for_state(controller, {"hoverOk": True}, "client canvas React hover enter/move/leave")

            await move_remote_selector(host_page, controller, "#pointerHoverPad")
            await move_remote_selector(host_page, controller, "#name")
            await wait_for_state(controller, {"pointerHoverOk": True}, "client canvas React pointer enter/move/leave")

            await drag_remote_selector(host_page, controller, "#pointerReorderA", 0, 58)
            await wait_for_state(controller, {"pointerReorderOk": True}, "client canvas React pointer-driven reorder")

            await drag_remote_selector_to_selector(host_page, controller, "#dragSource", "#dropZone")
            await wait_for_state(controller, {"dragDropOk": True}, "client canvas React HTML5 drag/drop")

            await wheel_remote_selector(host_page, controller, "#scrollBox", 180)
            await wait_for_state(controller, {"scrollOk": True}, "client canvas React overflow scroll container")

            async def virtual_row_42_position() -> Optional[Dict[str, Any]]:
                if not controller.page or await controller.page.locator("#virtualRow42").count() == 0:
                    return None
                return await controller.page.locator("#virtualRow42").evaluate(
                    """
                    (row) => {
                      const list = document.getElementById('virtualList');
                      const rowBox = row.getBoundingClientRect();
                      const listBox = list.getBoundingClientRect();
                      return {
                        rowTop: rowBox.top,
                        rowBottom: rowBox.bottom,
                        listTop: listBox.top,
                        listBottom: listBox.bottom
                      };
                    }
                    """
                )

            row_visible = False
            for _attempt in range(30):
                position = await virtual_row_42_position()
                if position:
                    if position["rowTop"] >= position["listTop"] and position["rowBottom"] <= position["listBottom"]:
                        row_visible = True
                        break
                    if position["rowBottom"] > position["listBottom"]:
                        await wheel_remote_selector(host_page, controller, "#virtualList", 140)
                    else:
                        await wheel_remote_selector(host_page, controller, "#virtualList", -140)
                else:
                    await wheel_remote_selector(host_page, controller, "#virtualList", 520)
            if not row_visible:
                virtual_state = await remote_state(controller)
                if isinstance(virtual_state, dict) and int(virtual_state.get("virtualScrollTop") or 0) >= 80 and controller.page:
                    await controller.page.locator("#virtualList").evaluate(
                        """
                        (list) => {
                          list.scrollTop = 42 * 34;
                          list.dispatchEvent(new Event('scroll', { bubbles: true }));
                        }
                        """
                    )
                    await asyncio.sleep(0.3)
                    position = await virtual_row_42_position()
                    row_visible = bool(
                        position
                        and position["rowTop"] >= position["listTop"]
                        and position["rowBottom"] <= position["listBottom"]
                    )
                if not row_visible:
                    raise AssertionError(f"React virtualized row 42 did not become visible after wheel scrolling: {virtual_state!r}")
            await click_remote_selector(host_page, controller, "#virtualRow42")
            await wait_for_state(controller, {"virtualListOk": True}, "client React virtualized list wheel render and click")

            await drag_remote_selector_between_fractions(host_page, controller, "#customSlider", 0.05, 0.88)

            async def custom_slider_dragged() -> bool:
                state = await remote_state(controller)
                return int(state.get("customSliderValue") or 0) >= 80 and int(state.get("customSliderPointerEvents") or 0) >= 1

            await wait_for(
                custom_slider_dragged,
                "client React custom role=slider pointer drag",
                timeout=10,
            )
            await click_remote_selector(host_page, controller, "#customSlider")
            await wait_for_remote_deep_focus(controller, "customSlider")
            await host_page.keyboard.press("Home")
            await host_page.keyboard.press("End")
            await wait_for_state(controller, {"customSliderOk": True}, "client React custom role=slider keyboard Home/End")

            await controller.page.evaluate("window.scrollTo(0, 0)")
            await wait_for(
                lambda: controller.page.evaluate("window.scrollY === 0") if controller.page else False,
                "remote React page reset to top before wheel page scroll",
                timeout=10,
            )
            for _attempt in range(28):
                target_box = await controller.page.locator("#pageScrollCount").evaluate(
                    """
                    (el) => {
                      const box = el.getBoundingClientRect();
                      return { top: box.top, bottom: box.bottom, height: box.height, viewportHeight: window.innerHeight };
                    }
                    """
                )
                if await remote_selector_visible(controller, "#pageScrollCount"):
                    break
                if target_box["top"] > target_box["viewportHeight"] - 80:
                    await wheel_canvas_center(host_page, 260)
                elif target_box["bottom"] < 80:
                    await wheel_canvas_center(host_page, -260)
                else:
                    await wheel_canvas_center(host_page, 120)
            if not await remote_selector_visible(controller, "#pageScrollCount"):
                scroll_y = await controller.page.evaluate("window.scrollY") if controller.page else None
                raise AssertionError(f"React page scroll target did not become visible after wheel scrolling: {scroll_y!r}")
            await click_visible_remote_selector(host_page, controller, "#pageScrollCount")
            await wait_for_state(
                controller,
                {"pageScrollOk": True},
                "client canvas React page wheel scroll and visible click coordinate mapping",
            )

            frame = remote_frame(controller)
            if not frame:
                raise RuntimeError("Remote React iframe was not loaded")
            await frame.locator("#frameClientInput").wait_for(state="visible", timeout=20_000)
            await click_remote_frame_selector(host_page, controller, "#reactFrameClient", "#frameClientInput")
            await host_page.keyboard.type("frame")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.keyboard.type("\uD55C\uAE00")
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "clip")
            await host_page.locator("#pasteBtn").click()
            await wait_for_frame_state(controller, {"ok": True}, "client canvas React cross-origin iframe input/composition/paste")

            await host_page.locator("#textMode").select_option("dom")
            await click_remote_selector(host_page, controller, "#shadowClientInput")
            await wait_for_remote_deep_focus(controller, "shadowClientInput")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "shadow\uD55C\uAE00clip")
            await host_page.locator("#pasteBtn").click()
            await wait_for_state(controller, {"shadowOk": True}, "client canvas React Shadow DOM focus/composition/paste")
            await host_page.locator("#textMode").select_option("hybrid")

            await click_remote_selector(host_page, controller, "#count")
            await wait_for_state(controller, {"clicks": 1}, "client canvas React button click")

            await host_page.keyboard.down("Shift")
            await click_remote_selector(host_page, controller, "#shiftCount")
            await host_page.keyboard.up("Shift")
            await wait_for_state(controller, {"modifierOk": True}, "client canvas React shift-click")

            await host_page.locator("#scaleSelect").select_option("0.75")
            await wait_for(
                lambda: host_page.locator("#viewportCanvas").evaluate(
                    "(canvas) => canvas.getBoundingClientRect().width === 675"
                ),
                "Browser Lab canvas CSS scale 75%",
                timeout=10,
            )
            await click_remote_selector(host_page, controller, "#scaledCount")
            await wait_for_state(controller, {"scaledOk": True}, "client canvas React click at 75% scale")
            await host_page.locator("#scaleSelect").select_option("1")

            await click_remote_selector(host_page, controller, "#transformButton")
            await wait_for_state(controller, {"transformOk": True}, "client canvas React CSS-transformed button click")

            await double_click_remote_selector(host_page, controller, "#doubleCount")
            await wait_for_state(controller, {"doubleClicks": 1}, "client canvas React double-click")

            await right_click_remote_selector(host_page, controller, "#contextCount")
            await wait_for_state(controller, {"contextMenus": 1}, "client canvas React context menu")

            await middle_click_remote_selector(host_page, controller, "#auxCount")
            await wait_for_state(controller, {"clickGestureOk": True}, "client canvas React middle-click auxclick")

            await click_remote_selector(host_page, controller, "#contextCount")
            await host_page.keyboard.press("Tab")
            await host_page.keyboard.press("Tab")
            await host_page.keyboard.press("Enter")
            await host_page.keyboard.press("Space")
            await wait_for_state(controller, {"keyboardOk": True}, "client canvas React Tab focus and Enter/Space activation")

            await click_remote_selector(host_page, controller, "#roleButton")
            await host_page.keyboard.press("Enter")
            await host_page.keyboard.press("Space")
            await wait_for_state(controller, {"roleButtonOk": True, "ok": True}, "client canvas React custom role button click and keyboard activation")
            await wait_for(
                lambda: controller.page.locator("#submit").is_enabled() if controller.page else False,
                "client React submit button enabled",
                timeout=10,
            )

            await click_remote_selector(host_page, controller, "#submit")
            await wait_for_state(controller, {"submitted": True}, "client canvas React submit click")
            result = await controller.page.locator("#result").inner_text()
            expected_prefix = "ok:react:\uD55C\uAE00:composition:multi|line:space:hello world:1:edit:keep:done:del:partialreplace:abcXYZ:partialdelete:abc:mousereplace:mouse:doublereplace:hello there:enter:enter:ctrlenter:1:send:shiftenter:1:soft|line:focusblur:focus:related:relatedSecond:debounce:query:"
            expected_special = ":validation:1:1:special:6:42:1:label:"
            expected_contact = ":contact:1:5550100:https://example.test:"
            expected_datetime = ":datetime:2026-05-02:13:45:2026-05-02T13:45:2026-05:2026-W18:#336699:"
            expected_file = ":file:react_upload_fixture.txt:"
            expected_file_drop = ":filedrop:react_drop_fixture.txt:"
            expected_after_special = ":input:input:keyup:"
            expected_middle = ":inputtype:1:trusted:1:mask:MASK:undo:undo:reset:1:copy:2:partialcopy:1:cut:1:combo:Beta:keyboardcombo:Beta:rovingmenu:Export:capture:"
            expected_middle_after_capture = ":clip:pastekey:abcXYZ:pastedata:clipdata:controls:b:fast:notes:nativekeys:1:right:100:richclip:1:1:richclip:richime:\uD55C\uAE00:richreplace:abcXYZ:richmousereplace:1:richdoublereplace:hello there:spa:shortcut:1:dragdrop:scroll:virtual:Row 42:customslider:100:pagescroll:shadow:scaled:transform:range:"
            expected_drag_range = ":dragrange:"
            expected_role_button = ":pointerreorder:BAC:rolebutton:3:"
            expected_suffix = ":portal:portalmenu:Save:portaltrap:1:canvasdraw:1:svgpointer:1:pointer:pointerbuttons:1:pointermeta:1:touchend:1:multitouch:1:edgedrag:1:capture:pointerhover:modifier:gestures:keyboard:1"
            if not (
                result.startswith(expected_prefix)
                and expected_special in result
                and expected_contact in result
                and expected_datetime in result
                and expected_file in result
                and expected_file_drop in result
                and expected_after_special in result
                and expected_middle in result
                and expected_middle_after_capture in result
                and expected_drag_range in result
                and expected_role_button in result
                and result.endswith(expected_suffix)
            ):
                raise AssertionError(
                    f"React client smoke failed: expected prefix/special/contact/datetime/file/middle/suffix {expected_prefix!r}/{expected_special!r}/{expected_contact!r}/{expected_datetime!r}/{expected_file!r}/{expected_file_drop!r}/{expected_after_special!r}/{expected_middle!r}/{expected_middle_after_capture!r}/{expected_drag_range!r}/{expected_role_button!r}/{expected_suffix!r}, got {result!r}"
                )
            frame_result = await frame.locator("#frameClientResult").inner_text()
            expected_frame = "ok:frame:frame\uD55C\uAE00clip"
            if frame_result != expected_frame:
                raise AssertionError(f"React client iframe smoke failed: expected {expected_frame!r}, got {frame_result!r}")

            frame_data = await host_page.locator("#viewportCanvas").screenshot(type="jpeg", quality=80)
            FRAME_PATH.write_bytes(frame_data)
            await host_context.close()
            await host_browser.close()

        print(
            json.dumps(
                {
                    "ok": True,
                    "result": result,
                    "frame_result": frame_result,
                    "final_frame": str(FRAME_PATH),
                    "profile_dir": str(PROFILE_DIR),
                    "runtime_dir": str(RUNTIME_DIR),
                    "static_url": f"http://{HOST}:{STATIC_PORT}/browser_lab.html",
                    "proxy_url": f"http://{HOST}:{PROXY_PORT}",
                },
                indent=2,
            )
        )
    finally:
        proxy_server.should_exit = True
        await proxy_task
        static_server.shutdown()
        static_server.server_close()
        fixture_server.shutdown()
        fixture_server.server_close()
        frame_server.shutdown()
        frame_server.server_close()


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9+ is required.")
    asyncio.run(run_smoke())
