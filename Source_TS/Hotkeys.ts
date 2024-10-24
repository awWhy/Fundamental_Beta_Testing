import { global, player } from './Player';
import { checkTab } from './Check';
import { switchTab } from './Update';
import { buyBuilding, collapseResetUser, dischargeResetUser, mergeResetUser, rankResetUser, stageResetUser, switchStage, toggleSwap, vaporizationResetUser } from './Stage';
import { buyAll, pauseGame } from './Main';
import { globalSave, specialHTML } from './Special';
import type { hotkeysList } from './Types';

export const hotkeys = {} as Record<string, hotkeysList>;
const hotkeyFunction = {
    makeAll: () => buyAll(),
    stage: (event) => {
        if (event.repeat && (player.inflation.vacuum || player.stage.active >= 4)) { return; }
        void stageResetUser();
    },
    discharge: () => void dischargeResetUser(),
    vaporization: (event) => {
        if (event.repeat) { return; }
        void vaporizationResetUser();
    },
    rank: () => void rankResetUser(),
    collapse: (event) => {
        if (event.repeat) { return; }
        void collapseResetUser();
    },
    galaxy: () => buyBuilding(3, 5),
    pause: (event) => {
        if (event.repeat || !globalSave.developerMode) { return; }
        void pauseGame();
    },
    toggleAll: (event) => {
        if (event.repeat) { return; }
        toggleSwap(0, 'buildings', true);
    },
    merge: (event) => {
        if (event.repeat) { return; }
        void mergeResetUser();
    },
    universe: () => buyBuilding(1, 6),
    tabRight: (event) => {
        if (event.repeat) { return; }
        changeTab('Right');
    },
    tabLeft: (event) => {
        if (event.repeat) { return; }
        changeTab('Left');
    },
    subtabUp: (event) => {
        if (event.repeat) { return; }
        changeSubtab('Up');
    },
    subtabDown: (event) => {
        if (event.repeat) { return; }
        changeSubtab('Down');
    },
    stageRight: (event) => {
        if (event.repeat) { return; }
        changeStage('Right');
    },
    stageLeft: (event) => {
        if (event.repeat) { return; }
        changeStage('Left');
    }
} as Record<hotkeysList, (event: KeyboardEvent) => void>;

/** Will remove identical hotkeys from globalSave */
export const assignHotkeys = () => {
    for (const key in hotkeys) { delete hotkeys[key]; } //Don't know better way for now
    const index = globalSave.toggles[0] ? 0 : 1;
    for (const key in globalSave.hotkeys) {
        const hotkey = globalSave.hotkeys[key as hotkeysList][index];
        if (hotkey === '' || hotkey == null) { continue; }
        if (hotkeys[hotkey] !== undefined) {
            globalSave.hotkeys[key as hotkeysList] = [];
        } else { hotkeys[hotkey] = key as hotkeysList; }
    }
};

/** Removes hotkey if exist, returns name of removed hotkey */
export const removeHotkey = (remove: string): string | null => {
    const test = hotkeys[remove];
    if (test === undefined) { return null; }
    globalSave.hotkeys[test] = [];
    return test;
};

export const detectHotkey = (check: KeyboardEvent) => {
    if (check.code === 'Tab') {
        document.body.classList.remove('noFocusOutline');
        return;
    } else {
        const activeType = (document.activeElement as HTMLInputElement)?.type;
        if (activeType === 'text' || activeType === 'number') { return; }
        document.body.classList.add('noFocusOutline');
    }
    if (global.hotkeys.disabled) { return; }
    const { key, code } = check;
    let { shiftKey } = check;

    if (shiftKey) { global.hotkeys.shift = true; }
    if (check.ctrlKey) { global.hotkeys.ctrl = true; }

    if (code === 'Escape') {
        if (check.metaKey || check.ctrlKey || shiftKey || check.altKey ||
            specialHTML.alert[0] !== null || specialHTML.bigWindow !== null) { return; }
        const notification = specialHTML.notifications[0];
        if (notification !== undefined) { notification[1](true); }
        return;
    }

    const numberKey = Number(code.replace('Digit', '').replace('Numpad', ''));
    if (!isNaN(numberKey) && code !== '') {
        if (check.metaKey || check.ctrlKey || check.altKey) { return; }
        if (isNaN(Number(key))) {
            if (!shiftKey) { //Numpad
                shiftKey = true;
                check.preventDefault();
            }
        }

        if (shiftKey) {
            if (check.repeat) { return; }
            toggleSwap(numberKey, 'buildings', true);
        } else if (numberKey !== 0) {
            buyBuilding(numberKey);
        } else { buyAll(); }
    } else {
        let name = check.metaKey ? 'Meta ' : '';
        if (check.ctrlKey) { name += 'Ctrl '; }
        if (shiftKey) { name += 'Shift '; }
        if (check.altKey) { name += 'Alt '; }
        name += globalSave.toggles[0] ?
            (key.length === 1 ? key.toUpperCase() : key.replace('Arrow', 'Arrow ')) :
            (key.length === 1 ? code.replace('Key', '') : code.replace('Arrow', 'Arrow '));
        const functionTest = hotkeyFunction[hotkeys[name]];
        if (functionTest !== undefined) {
            functionTest(check);
            check.preventDefault();
        }
    }
};

const changeTab = (direction: 'Left' | 'Right') => {
    const tabs = global.tabList.tabs;
    let index = tabs.indexOf(global.tab);

    if (direction === 'Left') {
        do {
            if (index <= 0) {
                index = tabs.length - 1;
            } else { index--; }
        } while (!checkTab(tabs[index]));
        switchTab(tabs[index]);
    } else {
        do {
            if (index >= tabs.length - 1) {
                index = 0;
            } else { index++; }
        } while (!checkTab(tabs[index]));
        switchTab(tabs[index]);
    }
};

const changeSubtab = (direction: 'Down' | 'Up') => {
    const tab = global.tab;
    const subtabs = global.tabList[`${tab}Subtabs`] as string[];
    if (subtabs.length < 2) { return; } //To remove never[]
    let index = subtabs.indexOf(global.subtab[`${tab}Current`]);

    if (direction === 'Down') {
        do {
            if (index <= 0) {
                index = subtabs.length - 1;
            } else { index--; }
        } while (!checkTab(tab, subtabs[index]));
        switchTab(tab, subtabs[index]);
    } else {
        do {
            if (index >= subtabs.length - 1) {
                index = 0;
            } else { index++; }
        } while (!checkTab(tab, subtabs[index]));
        switchTab(tab, subtabs[index]);
    }
};

const changeStage = (direction: 'Left' | 'Right') => {
    const activeAll = global.stageInfo.activeAll;
    if (activeAll.length === 1) { return; }
    let index = activeAll.indexOf(player.stage.active);

    if (direction === 'Left') {
        if (index <= 0) {
            index = activeAll.length - 1;
        } else { index--; }
        switchStage(activeAll[index]);
    } else {
        if (index >= activeAll.length - 1) {
            index = 0;
        } else { index++; }
        switchStage(activeAll[index]);
    }
};
