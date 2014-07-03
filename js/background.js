var tabsList = [];
var contextMenuId = undefined;
var contextMenuInc = 0;
var contextMenuList = [];
var contextMenuContext = ["all"];
var contextMenuAlias = {};

var currentWindowId = undefined;

var _updateTabListTimer = undefined;
var _updateTabListLocked = false;
var requestTabList = function(){
	_updateTabListLocked = true;

	chrome.windows.getCurrent({}, function(wnd){
		console.log(wnd);
		chrome.tabs.query({}, function(tabs) {
			var currentWindowTabs = [];
			var otherWindowTabs = [];
			for (var i = 0; i < tabs.length; i++) {
				if (tabs[i].windowId == wnd.id) {
					currentWindowTabs.push(tabs[i]);
				} else {
					otherWindowTabs.push(tabs[i]);
				}
			}
			tabsList = currentWindowTabs.concat(otherWindowTabs);
			updateContextMenu();
			_updateTabListLocked = false;
		});
	});
};
var updateTabList = function(){
	clearTimeout(_updateTabListTimer);
	if ( !_updateTabListLocked ) {
		_updateTabListTimer = setTimeout(requestTabList, 1000);
	} else {
		_updateTabListTimer = setTimeout(updateTabList, 1000);
	}
};
var openTab = function(tabId){
	if (tabId) {
		chrome.tabs.get( tabId, function(tab) {
			if (tab) {
				chrome.windows.update(tab.windowId, {focused: true}, function(){
					chrome.tabs.update( tabId, {selected: true} );
				});
			}
		});
	};
};

chrome.tabs.onCreated.addListener(updateTabList);
chrome.tabs.onUpdated.addListener(updateTabList);
chrome.tabs.onMoved.addListener(updateTabList);
chrome.tabs.onActiveChanged.addListener(updateTabList);

chrome.extension.onMessage.addListener(function(data, sender, sendResponse){
	var self = this;
	switch( data.query ){
	case 'list':
		chrome.tabs.sendMessage(sender.tab.id, {query: 'list', body: tabsList}, null);
		updateContextMenu();
	break;
	case 'tab':
		openTab(parseInt(data.id));
	break;
	case 'newtab':
		chrome.tabs.create({ 'url' :chrome.extension.getURL('newtab.html') });
	break;
	case 'event':
		switch( data.e.eventType ){
		case 'mousemove':
			chrome.tabs.executeScript(sender.tab.id, {code: 'eventTransmitter({"eventType": "mousemove", "screenX":'+data.e.screenX+', "screenY":'+data.e.screenY+'})', allFrames:false});
		break;
		case 'keydown':
			chrome.tabs.executeScript(sender.tab.id, {code: 'eventTransmitter({"eventType": "keydown", "keyCode":'+data.e.keyCode+', "ctrlKey":'+data.e.ctrlKey+'})', allFrames:false});
		break;
		case 'keyup':
			chrome.tabs.executeScript(sender.tab.id, {code: 'eventTransmitter({"eventType": "keyup", "keyCode":'+data.e.keyCode+', "ctrlKey":'+data.e.ctrlKey+'})', allFrames:false});
		break;
		}
	break;
	case 'favorites':
		chrome.bookmarks.getTree(function(tree){ 
			chrome.tabs.sendMessage(sender.tab.id, {query: 'favorites', body: tree}, null);
		});
	break;
	case 'check_window_state':
		chrome.windows.getCurrent({}, function(wnd){
			if (wnd.id != -1) {
				var fullscreen = ( wnd.state == 'fullscreen' );
				chrome.tabs.query({
					windowId: wnd.id
				}, function(tabs){
					for (var i = 0; i < tabs.length; i++) {
						chrome.tabs.sendMessage(tabs[i].id, {query: 'fullscreen', status: fullscreen}, null);
					}
				});
			}
		});
	break;
	}
});


var updateContextMenu = function(){
	chrome.contextMenus.removeAll(function(){
		contextMenuId = Math.random()+''+Math.random()+''+Math.random();
		contextMenuAlias = {};
		contextMenuId = chrome.contextMenus.create({
			id: contextMenuId,
			title: chrome.i18n.getMessage("contextMenuTitle"),
			contexts: contextMenuContext
		});
		chrome.contextMenus.create({
			id: contextMenuId+'newtab',
			parentId: contextMenuId,
			title: chrome.i18n.getMessage("newTab"),
			contexts: contextMenuContext
		});
		contextMenuInc++;
		contextMenuList.push(chrome.contextMenus.create({
			id: contextMenuId+'-'+contextMenuInc,
			parentId: contextMenuId,
			contexts: contextMenuContext,
			type: 'separator'
		}));

		contextMenuList = [];

		if ( tabsList.length > 0 ) {
			var windowId = tabsList[0].windowId;
			for (var i = 0; i < tabsList.length; i++) {
				if (windowId!=tabsList[i].windowId) {
					windowId = tabsList[i].windowId;
					contextMenuInc++;
					contextMenuList.push(chrome.contextMenus.create({
						id: contextMenuId+'-'+contextMenuInc,
						parentId: contextMenuId,
						contexts: contextMenuContext,
						type: 'separator'
					}));
				}

				contextMenuInc++;
				var contextItemId = contextMenuId+'-'+contextMenuInc;
				contextMenuList.push(chrome.contextMenus.create({
					id: contextItemId,
					parentId: contextMenuId,
					title: tabsList[i].title||chrome.i18n.getMessage("blankTabTitle"),
					contexts: contextMenuContext
				}));
				contextMenuAlias[contextItemId] = tabsList[i].id;
			}
		}
	});
};

requestTabList();

chrome.contextMenus.onClicked.addListener(function(menuItem, tab){
	var tabId = contextMenuAlias[menuItem.menuItemId];
	if (tabId) {
		openTab(tabId);
	} else if (menuItem.menuItemId == contextMenuId+'newtab') {
		chrome.tabs.create({ 'url' :chrome.extension.getURL('newtab.html') });
	}
});

chrome.windows.onFocusChanged.addListener(function(){
	chrome.windows.getCurrent({}, function(wnd){
		if (wnd.id != -1) {
			var fullscreen = ( wnd.state == 'fullscreen' );
			chrome.tabs.query({
				windowId: wnd.id
			}, function(tabs){
				for (var i = 0; i < tabs.length; i++) {
					chrome.tabs.sendMessage(tabs[i].id, {query: 'fullscreen', status: fullscreen}, null);
				}
			});
		}
	});
});
