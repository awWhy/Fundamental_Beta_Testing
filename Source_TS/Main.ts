import { player, global, playerStart, updatePlayer, buildVersionInfo, deepClone } from './Player';
import { getUpgradeDescription, timeUpdate, switchTab, numbersUpdate, visualUpdate, format, getChallengeDescription, getChallengeReward, stageUpdate, getStrangenessDescription, visualUpdateResearches, visualUpdateInflation } from './Update';
import { assignStrangeInfo, autoElementsSet, autoResearchesSet, autoUpgradesSet, buyBuilding, buyStrangeness, buyUpgrades, collapseResetUser, dischargeResetUser, enterExitChallengeUser, inflationRefund, mergeResetUser, rankResetUser, stageResetUser, switchStage, toggleConfirm, toggleSwap, vaporizationResetUser } from './Stage';
import { Alert, hideFooter, Prompt, setTheme, changeFontSize, changeFormat, specialHTML, replayEvent, Confirm, preventImageUnload, Notify, MDStrangenessPage, globalSave, toggleSpecial, saveGlobalSettings } from './Special';
import { detectHotkey } from './Hotkeys';
import { prepareVacuum } from './Vacuum';
import { checkUpgrade } from './Check';

/** Only for static HTML, by default (false) throws error if id is null */
export const getId = (id: string, noError = false): HTMLElement => {
    const test = specialHTML.cache.idMap.get(id);
    if (test !== undefined) { return test; }

    const store = document.getElementById(id);
    if (store !== null) {
        specialHTML.cache.idMap.set(id, store);
        return store;
    }

    if (noError) { return null as unknown as HTMLElement; }
    if (global.debug.errorID) {
        global.debug.errorID = false;
        Notify(`Error encountered, ID - '${id}' doesn't exist`);
        setTimeout(() => { global.debug.errorID = true; }, 6e4);
    }
    throw new ReferenceError(`ID - '${id}' doesn't exist`);
};

/** Id collection will be auto updated by browser */
export const getClass = (idCollection: string): HTMLCollectionOf<HTMLElement> => {
    const test = specialHTML.cache.classMap.get(idCollection);
    if (test !== undefined) { return test; }
    const store = document.getElementsByClassName(idCollection) as HTMLCollectionOf<HTMLElement>;
    specialHTML.cache.classMap.set(idCollection, store);
    return store;
};

/** Only for static HTML */
export const getQuery = (query: string): HTMLElement => {
    const test = specialHTML.cache.queryMap.get(query);
    if (test !== undefined) { return test; }

    const store = document.querySelector(query) as HTMLElement; //Can't add null type due to eslint being buggy
    if (store !== null) {
        specialHTML.cache.queryMap.set(query, store);
        return store;
    }

    if (global.debug.errorQuery) {
        global.debug.errorQuery = false;
        Notify(`Error encountered, Query - '${query}' failed to find anything`);
        setTimeout(() => { global.debug.errorQuery = true; }, 6e4);
    }
    throw new ReferenceError(`Query - '${query}' failed`);
};

const handleOfflineTime = (): number => {
    const time = player.time;
    const timeNow = Date.now();
    const offlineTime = (timeNow - time.updated) / 1000;
    time.updated = timeNow;
    time.export[0] += offlineTime;
    return offlineTime;
};
export const simulateOffline = async(offline: number, autoAccept = !globalSave.developerMode) => {
    if (!global.paused) {
        global.paused = true;
        changeIntervals();
    }
    if (player.time.offline < 0) {
        offline += player.time.offline;
        player.time.offline = 0;
    }
    if (offline > 86400) {
        offline = 86400;
    } else if (offline <= 0) {
        player.time.offline += offline;
        global.paused = false;
        return changeIntervals();
    }
    if (!autoAccept && !(await Confirm(`Claim ${format(offline, { type: 'time', padding: false })} worth of Offline time?\nWill be lost if not accepted`, 2))) {
        global.lastSave += handleOfflineTime();
        global.paused = false;
        return changeIntervals();
    }
    getId('offlineMain').style.display = '';
    calculateOffline(offline);

    getId('offlineAccelerate').addEventListener('click', offlineAccelerate);
    getId('offlineCancel').addEventListener('click', offlineCancel);
    document.body.addEventListener('keydown', offlineAccelerate);
};
const calculateOffline = (warpTime: number, start = warpTime) => {
    const rate = global.debug.offlineSpeed;
    const time = Math.min(rate === 0 ? warpTime : 600 * rate, warpTime);
    warpTime -= time;
    try {
        timeUpdate(time, Math.max(time / 600, 1));
    } catch (error) {
        offlineEnd();
        void Alert(`Offline calculation failed due to error:\n${error}`, 1);
        throw error;
    }
    if (warpTime > 0) {
        setTimeout(calculateOffline, 0, warpTime, start);
        getId('offlineRemains').textContent = format(warpTime, { type: 'time' });
        getId('offlinePercentage').textContent = format(100 - warpTime / start * 100, { padding: true });
        if (globalSave.SRSettings[0]) { getQuery('#offlineMain > div').ariaValueText = `${format(100 - warpTime / start * 100)}% done`; }
    } else { offlineEnd(); }
};
const offlineEnd = () => {
    global.debug.offlineSpeed = 1;
    global.paused = false;
    changeIntervals();
    getId('offlineMain').style.display = 'none';
    visualUpdate();
    numbersUpdate();

    getId('offlineAccelerate').removeEventListener('click', offlineAccelerate);
    getId('offlineCancel').removeEventListener('click', offlineCancel);
    document.body.removeEventListener('keydown', offlineAccelerate);
};
const offlineCancel = () => (global.debug.offlineSpeed = 0);
const offlineAccelerate = (event: KeyboardEvent | MouseEvent) => {
    if (event instanceof KeyboardEvent && event.key !== 'Escape') { return; }
    global.debug.offlineSpeed *= 2;
    if (globalSave.SRSettings[0]) { getId('SRMain').textContent = 'Offline time will be calculated faster now'; }
};

export const changeIntervals = () => {
    const intervalsId = global.intervalsId;
    const intervals = globalSave.intervals;
    const paused = global.paused;

    clearInterval(intervalsId.main);
    clearInterval(intervalsId.numbers);
    clearInterval(intervalsId.visual);
    clearInterval(intervalsId.autoSave);
    intervalsId.main = paused ? undefined : setInterval(timeUpdate, intervals.main);
    intervalsId.numbers = paused ? undefined : setInterval(numbersUpdate, intervals.numbers);
    intervalsId.visual = paused ? undefined : setInterval(visualUpdate, intervals.visual);
    intervalsId.autoSave = paused ? undefined : setInterval(saveGame, intervals.autoSave);
};

const saveGame = async(noSaving = false): Promise<string | null> => {
    if (global.paused) {
        Notify('No saving while game is paused');
        return null;
    }
    try {
        player.history.stage.list = global.historyStorage.stage.slice(0, player.history.stage.input[0]);

        const save = btoa(JSON.stringify(player));
        if (!noSaving) {
            localStorage.setItem('testing_save', save);
            clearInterval(global.intervalsId.autoSave);
            global.intervalsId.autoSave = setInterval(saveGame, globalSave.intervals.autoSave);
            getId('isSaved').textContent = 'Saved';
            global.lastSave = 0;
        }
        return save;
    } catch (error) {
        const stack = (error as { stack: string }).stack;
        void Alert(`Failed to save game\n${typeof stack === 'string' ? stack.replaceAll(`${window.location.origin}/`, '') : error}`, 1);
        throw error;
    }
};
const loadGame = (save: string) => {
    if (global.paused) { return Notify('No loading while game is paused'); }
    global.paused = true;
    changeIntervals();
    try {
        const versionCheck = updatePlayer(JSON.parse(atob(save)));

        global.lastSave = handleOfflineTime();
        Notify(`This save is ${format(global.lastSave, { type: 'time', padding: false })} old${versionCheck !== player.version ? `\nSave file version is ${versionCheck}` : ''}`);
        stageUpdate('reload');

        void simulateOffline(global.lastSave);
    } catch (error) {
        prepareVacuum(Boolean(player.inflation.vacuum)); //Fix vacuum state
        global.paused = false;
        changeIntervals();

        void Alert(`Incorrect save file format\n${error}`);
        throw error;
    }
};
const exportFileGame = async() => {
    if ((player.stage.true >= 7 || player.stage.resets >= (player.inflation.vacuum ? 1 : 4)) &&
        (!globalSave.developerMode || await Confirm('Claim export reward? Export storage will not be reduced if to refuse'))) {
        awardExport();
    }

    const save = await saveGame(globalSave.developerMode);
    if (save === null) { return; }
    const a = document.createElement('a');
    a.href = `data:text/plain,${save}`;
    a.download = replaceSaveFileSpecials();
    a.click();
};
const awardExport = () => {
    const exportReward = player.time.export;
    if (exportReward[0] < 0) { return; }
    const { strange } = player;
    const conversion = Math.min(exportReward[0] / 86400, 1);
    const quarks = (exportReward[1] / 2.5 + 1) * conversion;

    strange[0].current += quarks;
    strange[0].total += quarks;
    exportReward[1] = Math.max(exportReward[1] - quarks, 0);
    if (player.strangeness[5][8] >= 1 || player.inflation.tree[3] >= 1) {
        const strangelets = exportReward[2] / 2.5 * conversion;
        strange[1].current += strangelets;
        strange[1].total += strangelets;
        exportReward[2] -= strangelets;
        assignStrangeInfo[1]();
    }
    assignStrangeInfo[0]();
    exportReward[0] = 0;
};

const saveConsole = async() => {
    const value = await Prompt("Available options:\n'Copy' - copy save file to clipboard\n'Delete' - delete your save file\n'Reset' - reset game global settings\n'Clear' - clear all domain data\nOr insert save file string here to load it");
    if (value === null || value === '') { return; }
    const lower = value.toLowerCase();

    if (lower === 'copy') {
        const save = await saveGame(true);
        if (save !== null) { void navigator.clipboard.writeText(save); }
    } else if (lower === 'delete' || lower === 'reset' || lower === 'clear') {
        global.paused = true;
        changeIntervals();
        if (lower === 'delete') {
            localStorage.removeItem('testing_save');
        } else if (lower === 'reset') {
            localStorage.removeItem('fundamentalSettings');
        } else { localStorage.clear(); }
        window.location.reload();
        void Alert('Awaiting game reload');
    } else if (value === 'devMode') {
        globalSave.developerMode = !globalSave.developerMode;
        Notify(`Developer mode is ${globalSave.developerMode ? 'now' : 'no longer'} active`);
        saveGlobalSettings();
    } else if (lower === 'achievement') {
        Notify('Unlocked a new Achievement');
    } else if (lower === 'slow' || lower === 'free') {
        Notify('Game speed was increased by 1x');
    } else {
        if (value.length < 20) { return void Alert(`Input '${value}' doesn't match anything`); }
        if (!await Confirm("Press 'Confirm' to load input as a save file\n(Input is too long to be displayed)")) { return; }
        loadGame(value);
    }
};

const replaceSaveFileSpecials = (): string => {
    let realName = player.fileName;

    const date = new Date();
    const dateIndex = realName.indexOf('[date');
    if (dateIndex >= 0) {
        const endIndex = realName.indexOf(']', dateIndex + 5);
        if (endIndex >= 0) {
            let replaced = realName.substring(dateIndex + 5, endIndex);
            const special = [
                'Y',
                'M',
                'D'
            ];
            const replaceWith = [
                `${date.getFullYear()}`,
                `${date.getMonth() + 1}`.padStart(2, '0'),
                `${date.getDate()}`.padStart(2, '0')
            ];
            for (let i = 0; i < special.length; i++) {
                replaced = replaced.replace(special[i], replaceWith[i]);
            }
            realName = realName.replace(realName.substring(dateIndex, endIndex + 1), replaced);
        }
    }
    const timeIndex = realName.indexOf('[time');
    if (timeIndex >= 0) {
        const endIndex = realName.indexOf(']', timeIndex + 5);
        if (endIndex >= 0) {
            let replaced = realName.substring(timeIndex + 5, endIndex);
            const special = [
                'H',
                'M',
                'S'
            ];
            const replaceWith = [
                `${date.getHours()}`.padStart(2, '0'),
                `${date.getMinutes()}`.padStart(2, '0'),
                `${date.getSeconds()}`.padStart(2, '0')
            ];
            for (let i = 0; i < special.length; i++) {
                replaced = replaced.replace(special[i], replaceWith[i]);
            }
            realName = realName.replace(realName.substring(timeIndex, endIndex + 1), replaced);
        }
    }

    const special = [
        '[version]',
        '[stage]',
        '[true]',
        '[strange]',
        '[vacuum]'
    ];
    const replaceWith = [
        player.version,
        global.stageInfo.word[player.stage.active],
        player.stage.true === 6 ? 'Void' : global.stageInfo.word[player.stage.true >= 7 ? 6 : player.stage.true],
        `${player.strange[0].total}`,
        `${player.inflation.vacuum}`
    ];
    for (let i = 0; i < special.length; i++) {
        realName = realName.replace(special[i], replaceWith[i]);
    }
    return `${realName}.txt`;
};

/* Arguments are not done as '(...data: any) => any, ...data: any' because TS won't do type safety */
/** If onceInstanly is true, then it will instanly call function once and then try to repeat it after delay */
const repeatFunction = (repeat: () => any, onceInstanly = false) => {
    if (onceInstanly) { repeat(); }
    if (global.intervalsId.mouseRepeat !== undefined) { return; }
    global.intervalsId.mouseRepeat = setTimeout(() => {
        global.intervalsId.mouseRepeat = setInterval(repeat, 50);
    }, 200);
};
const cancelRepeat = () => {
    clearInterval(global.intervalsId.mouseRepeat);
    global.intervalsId.mouseRepeat = undefined;
};

const hoverUpgrades = (index: number, type: 'upgrades' | 'researches' | 'researchesExtra' | 'researchesAuto' | 'ASR' | 'elements' | 'inflation') => {
    if (type === 'inflation') {
        global.lastInflation = index;
    } else {
        if (player.toggles.hover[0] && player.stage.true >= 2 && (type !== 'researchesAuto' || checkUpgrade(index, player.stage.active, 'researchesAuto'))) {
            buyUpgrades(index, player.stage.active, type);
        }
        if (type === 'elements') {
            global.lastElement = index;
        } else { global.lastUpgrade[player.stage.active] = [index, type]; }
    }
    getUpgradeDescription(index, type);
};
const hoverStrangeness = (index: number, stageIndex: number, type: 'strangeness' | 'milestones') => {
    if (type === 'strangeness') {
        global.lastStrangeness = [index, stageIndex];
    } else { global.lastMilestone = [index, stageIndex]; }
    getStrangenessDescription(index, stageIndex, type);
};
const hoverChallenge = (index: number, type: 'challenge' | 'reward') => {
    if (type === 'challenge') {
        global.lastChallenge[0] = index;
        getChallengeDescription(index);
    } else {
        global.lastChallenge[1] = index;
        getChallengeReward(index);
    }
};

export const buyAll = () => {
    const active = player.stage.active;
    for (let i = 1; i < specialHTML.longestBuilding; i++) {
        buyBuilding(i, active, 0);
    }
};

export const pauseGame = async() => {
    if (global.paused) { return; }
    global.paused = true;
    changeIntervals();
    const claim = await Confirm("Game is currently paused. Any button bellow will unpause, press 'Confirm' to keep Offline time");

    const offline = handleOfflineTime();
    global.lastSave += offline;
    if (claim) {
        void simulateOffline(offline, true);
    } else {
        global.paused = false;
        changeIntervals();
    }
};

try { //Start everything
    preventImageUnload();
    const body = document.body;

    const globalSaveStart = deepClone(globalSave); //For cases with incorrect length
    const globalSettings = localStorage.getItem('fundamentalSettings');
    if (globalSettings !== null) {
        Object.assign(globalSave, JSON.parse(atob(globalSettings)));
        (getId('decimalPoint') as HTMLInputElement).value = globalSave.format[0];
        (getId('thousandSeparator') as HTMLInputElement).value = globalSave.format[1];
        (getId('mainInterval') as HTMLInputElement).value = `${globalSave.intervals.main}`;
        (getId('numbersInterval') as HTMLInputElement).value = `${globalSave.intervals.numbers}`;
        (getId('visualInterval') as HTMLInputElement).value = `${globalSave.intervals.visual / 1000}`;
        (getId('autoSaveInterval') as HTMLInputElement).value = `${globalSave.intervals.autoSave / 1000}`;
        for (let i = 0; i < globalSaveStart.toggles.length; i++) { toggleSpecial(i, 'global'); }
        if (globalSave.fontSize !== 16) { changeFontSize(true); } //Also will set breakpoints for screen size
        if (globalSave.toggles[2]) { body.style.userSelect = ''; }
        if (globalSave.toggles[1]) {
            const elementsArea = getId('upgradeSubtabElements');
            elementsArea.id = 'ElementsTab';
            getId('upgradeTab').after(elementsArea);
            specialHTML.cache.idMap.delete('upgradeSubtabElements');

            const elementsButton = getId('upgradeSubtabBtnElements');
            elementsButton.id = 'ElementsTabBtn';
            elementsButton.classList.add('stage4Include');
            getId('upgradeTabBtn').after(elementsButton);
            specialHTML.cache.idMap.delete('upgradeSubtabBtnElements');

            const tabList = global.tabList;
            tabList.ElementsSubtabs = [];
            tabList.upgradeSubtabs.splice(tabList.upgradeSubtabs.indexOf('Elements'), 1);
            tabList.tabs.splice(tabList.tabs.indexOf('upgrade') + 1, 0, 'Elements');
        }

        if (globalSave.MDSettings[0]) {
            (document.getElementById('MDMessage1') as HTMLElement).remove();
            specialHTML.styleSheet.textContent += 'input[type = "image"], img { -webkit-touch-callout: none; }'; //Safari junk to disable image hold menu
            specialHTML.styleSheet.textContent += '#themeArea.windowOpen > div > div { display: flex; } #themeArea.windowOpen > div > button { clip-path: circle(0); }'; //More Safari junk to make windows work without focus
            (getId('file') as HTMLInputElement).accept = ''; //Accept for unknown reason not properly supported on phones

            const arrowStage = document.createElement('button');
            arrowStage.append(document.createElement('div'));
            arrowStage.type = 'button';
            const arrowReset1 = document.createElement('button');
            arrowReset1.append(document.createElement('div'));
            arrowReset1.type = 'button';
            getId('resetStage').append(arrowStage);
            arrowStage.addEventListener('click', () => getId('resetStage').classList.toggle('open'));
            arrowStage.addEventListener('blur', () => getId('resetStage').classList.remove('open'));
            getId('reset1Main').append(arrowReset1);
            arrowReset1.addEventListener('click', () => getId('reset1Main').classList.toggle('open'));
            arrowReset1.addEventListener('blur', () => getId('reset1Main').classList.remove('open'));
            specialHTML.styleSheet.textContent += '#resets { row-gap: 1em; } #resets > section { position: relative; flex-direction: row; justify-content: center; width: unset; padding: unset; row-gap: unset; background-color: unset; border: unset; } #resets > section:not(.open) > p { display: none !important; }';
            specialHTML.styleSheet.textContent += '#resets > section > button:last-of-type { width: 2.2em !important; margin-left: -2px; } #resets button > div { clip-path: polygon(0 0, 50% 100%, 100% 0, 50% 25%); width: 1.24em; height: 1.24em; background-color: var(--main-text); pointer-events: none; margin: auto; } #resets p { position: absolute; width: 17.4em; padding: 0.5em 0.6em 0.6em; background-color: var(--window-color); border: 2px solid var(--window-border); top: calc(100% - 2px); z-index: 1; box-sizing: content-box; }';

            const structuresButton = document.createElement('button');
            structuresButton.textContent = 'Structures';
            structuresButton.id = 'structuresFooter';
            structuresButton.type = 'button';
            const stageButton = document.createElement('button');
            stageButton.textContent = 'Stage';
            stageButton.id = 'stageFooter';
            stageButton.type = 'button';
            const reset1Button = document.createElement('button');
            reset1Button.id = 'reset1Footer';
            reset1Button.type = 'button';
            const resetCollapse = document.createElement('button');
            resetCollapse.textContent = 'Collapse';
            resetCollapse.id = 'resetCollapseFooter';
            resetCollapse.type = 'button';
            resetCollapse.className = 'stage5Only';
            const resetGalaxy = document.createElement('button');
            resetGalaxy.textContent = 'Galaxy';
            resetGalaxy.id = 'resetGalaxyFooter';
            resetGalaxy.type = 'button';
            resetGalaxy.className = 'stage4Only';
            getId('phoneHotkeys').prepend(resetGalaxy, reset1Button, resetCollapse, stageButton, structuresButton);

            const createUpgButton = document.createElement('button');
            createUpgButton.classList.add('hollowButton');
            createUpgButton.textContent = 'Create';
            createUpgButton.id = 'upgradeCreate';
            createUpgButton.type = 'button';
            getId('toggleHover0').after(createUpgButton);

            const createInfButton = document.createElement('button');
            createInfButton.classList.add('hollowButton');
            createInfButton.textContent = 'Activate';
            createInfButton.id = 'inflationActivate';
            createInfButton.type = 'button';
            getId('inflationRefund').before(createInfButton);

            const pages = document.createElement('div');
            pages.id = 'strangenessPages';
            pages.innerHTML = '<button type="button" id="strangenessPage1" class="stage1borderImage hollowButton">1</button><button type="button" id="strangenessPage2" class="stage2borderImage hollowButton">2</button><button type="button" id="strangenessPage3" class="stage3borderImage hollowButton">3</button><button type="button" id="strangenessPage4" class="stage4borderImage hollowButton">4</button><button type="button" id="strangenessPage5" class="stage5borderImage hollowButton">5</button><button type="button" id="strangenessCreate" class="hollowButton">Create</button>';
            specialHTML.styleSheet.textContent += '#strangenessPages { display: flex; justify-content: center; column-gap: 0.3em; } #strangenessPages button { width: 2.08em; height: calc(2.08em - 2px); border-top: none; border-radius: 0 0 4px 4px; } #strangenessCreate { width: unset !important; padding: 0 0.4em; }';
            getId('strangenessResearch').append(pages);

            const MDToggle1 = document.createElement('li');
            MDToggle1.innerHTML = '<label>Keep mouse events<button type="button" id="MDToggle1" class="specialToggle">OFF</button></label>';
            getId('MDLi').after(MDToggle1);

            getId('MDToggle1').addEventListener('click', () => toggleSpecial(1, 'mobile', true, true));
            for (let i = 0; i < globalSaveStart.MDSettings.length; i++) { toggleSpecial(i, 'mobile'); }
        }
        if (globalSave.SRSettings[0]) {
            (document.getElementById('SRMessage1') as HTMLElement).remove();
            for (let i = 0; i < 3; i++) {
                const effectID = getId(i === 0 ? 'solarMassExplanation' : `star${i}Explanation`);
                effectID.textContent = ` (${effectID.textContent})`;
            }
            for (let i = 1; i <= 1; i++) {
                const effectID = getId(`merge${i}Explanation`);
                effectID.textContent = ` (${effectID.textContent})`;
            }

            const SRMainDiv = document.createElement('article');
            SRMainDiv.innerHTML = '<h3>Information for Screen reader</h3><p id="SRTab" aria-live="polite"></p><p id="SRStage" aria-live="polite"></p><p id="SRMain" aria-live="assertive"></p>';
            SRMainDiv.className = 'reader';
            getId('fakeFooter').before(SRMainDiv);

            const SRToggle1 = document.createElement('li');
            SRToggle1.innerHTML = '<label>Keep tab index on created Upgrades<button type="button" id="SRToggle1" class="specialToggle">OFF</button></label>';
            const SRToggle2 = document.createElement('li');
            SRToggle2.innerHTML = '<label>Keep tab index on primary buttons<button type="button" id="SRToggle2" class="specialToggle">OFF</button></label>';
            getId('SRLi').after(SRToggle1, SRToggle2);

            getId('SRToggle1').addEventListener('click', () => {
                toggleSpecial(1, 'reader', true);
                stageUpdate('reload');
                for (let s = 1; s < playerStart.strangeness.length; s++) {
                    for (let i = 0; i < global.strangenessInfo[s].maxActive; i++) {
                        visualUpdateResearches(i, s, 'strangeness');
                    }
                }
                visualUpdateInflation();
            });

            const primaryIndex = (reload = false) => {
                if (!reload) { toggleSpecial(2, 'reader', true); }
                const newTab = globalSave.SRSettings[2] ? 0 : -1;
                getId('stageReset').tabIndex = newTab;
                getId('reset1Button').tabIndex = newTab;
                for (let i = 1; i < specialHTML.longestBuilding; i++) {
                    getId(`building${i}Btn`).tabIndex = newTab;
                    getId(`toggleBuilding${i}`).tabIndex = newTab;
                }
                getId('toggleBuilding0').tabIndex = newTab;
                for (const tabText of global.tabList.tabs) {
                    getId(`${tabText}TabBtn`).tabIndex = newTab;
                    for (const subtabText of global.tabList[`${tabText}Subtabs`]) {
                        getId(`${tabText}SubtabBtn${subtabText}`).tabIndex = newTab;
                    }
                }
                for (let i = 1; i < global.stageInfo.word.length; i++) {
                    getId(`${global.stageInfo.word[i]}Switch`).tabIndex = newTab;
                }
            };
            getId('SRToggle2').addEventListener('click', () => { primaryIndex(); });

            if (globalSave.SRSettings[2]) { primaryIndex(true); }
            for (let i = 0; i < globalSaveStart.SRSettings.length; i++) { toggleSpecial(i, 'reader'); }
            specialHTML.styleSheet.textContent += '#starEffects > p > span, #mergeEffects > p > span { display: unset !important; }';
        }
        if (globalSave.developerMode) {
            const pauseButton = document.createElement('button');
            pauseButton.classList.add('hollowButton');
            pauseButton.textContent = 'Pause';
            pauseButton.type = 'button';
            getId('numbersLi').append(pauseButton);
            pauseButton.addEventListener('click', pauseGame);
        }
    }

    let oldVersion = player.version;
    const save = localStorage.getItem('testing_save');
    if (save !== null) {
        oldVersion = updatePlayer(JSON.parse(atob(save)));
    } else {
        prepareVacuum(false); //Set buildings values
        updatePlayer(deepClone(playerStart));
    }

    /* Global */
    const MD = globalSave.MDSettings[0];
    const SR = globalSave.SRSettings[0];
    const PC = !MD || globalSave.MDSettings[1];
    body.addEventListener('keydown', (key: KeyboardEvent) => detectHotkey(key));
    const releaseHotkey = (event: KeyboardEvent | MouseEvent) => {
        if (global.hotkeys.shift && !event.shiftKey) { global.hotkeys.shift = false; }
        if (global.hotkeys.ctrl && !event.ctrlKey) { global.hotkeys.ctrl = false; }
    };
    body.addEventListener('keyup', releaseHotkey);
    body.addEventListener('contextmenu', (event) => {
        const activeType = (document.activeElement as HTMLInputElement)?.type;
        if (activeType !== 'text' && activeType !== 'number' && !globalSave.developerMode) { event.preventDefault(); }
    });
    if (PC) {
        body.addEventListener('mouseup', (event) => {
            cancelRepeat();
            releaseHotkey(event);
        });
        body.addEventListener('mouseleave', cancelRepeat);
    }
    if (MD) {
        body.addEventListener('touchend', cancelRepeat);
        body.addEventListener('touchcancel', cancelRepeat);
    }

    /* Toggles */
    for (let i = 0; i < globalSaveStart.toggles.length; i++) {
        getId(`globalToggle${i}`).addEventListener('click', () => {
            toggleSpecial(i, 'global', true, i === 1);
            if (i === 2) {
                document.body.style.userSelect = globalSave.toggles[2] ? '' : 'none';
            }
        });
    }
    for (let i = 0; i < playerStart.toggles.normal.length; i++) {
        getId(`toggleNormal${i}`).addEventListener('click', () => toggleSwap(i, 'normal', true));
    }
    for (let i = 0; i < playerStart.toggles.confirm.length; i++) {
        getId(`toggleConfirm${i}`).addEventListener('click', () => toggleConfirm(i, true));
    }
    for (let i = 0; i < specialHTML.longestBuilding; i++) {
        getId(`toggleBuilding${i}`).addEventListener('click', () => toggleSwap(i, 'buildings', true));
    }
    for (let i = 0; i < playerStart.toggles.hover.length; i++) {
        getId(`toggleHover${i}`).addEventListener('click', () => toggleSwap(i, 'hover', true));
    }
    for (let i = 0; i < playerStart.toggles.max.length; i++) {
        getId(`toggleMax${i}`).addEventListener('click', () => toggleSwap(i, 'max', true));
    }
    for (let i = 0; i < playerStart.toggles.auto.length; i++) {
        getId(`toggleAuto${i}`).addEventListener('click', () => {
            toggleSwap(i, 'auto', true);
            if (i === 5) {
                autoUpgradesSet('all');
            } else if (i === 6) {
                autoResearchesSet('researches', 'all');
            } else if (i === 7) {
                autoResearchesSet('researchesExtra', 'all');
            } else if (i === 8) {
                autoElementsSet();
            }
        });
    }

    /* Stage tab */
    {
        const clickHoldFunc = () => {
            if (player.inflation.vacuum || player.stage.active >= 4) { return; }
            void stageResetUser();
        };
        const stageButton = getId('stageReset');
        stageButton.addEventListener('click', stageResetUser);
        if (PC) { stageButton.addEventListener('mousedown', () => repeatFunction(clickHoldFunc)); }
        if (MD) {
            stageButton.addEventListener('touchstart', () => repeatFunction(clickHoldFunc));
            const footerButton = getId('stageFooter');
            footerButton.addEventListener('click', stageResetUser);
            footerButton.addEventListener('touchstart', () => repeatFunction(clickHoldFunc));
            if (PC) { footerButton.addEventListener('mousedown', () => repeatFunction(clickHoldFunc)); }
        }
    }
    {
        const clickFunc = () => {
            const active = player.stage.active;
            if (active === 1) {
                void dischargeResetUser();
            } else if (active === 2) {
                void vaporizationResetUser();
            } else if (active === 3) {
                void rankResetUser();
            } else if (active === 4) {
                void collapseResetUser();
            } else if (active === 5) {
                void mergeResetUser();
            }
        };
        const clickHoldFunc = () => {
            if (player.stage.active !== 1 && player.stage.active !== 3) { return; }
            clickFunc();
        };
        const resetButton = getId('reset1Button');
        resetButton.addEventListener('click', clickFunc);
        if (PC) { resetButton.addEventListener('mousedown', () => repeatFunction(clickHoldFunc)); }
        if (MD) {
            resetButton.addEventListener('touchstart', () => repeatFunction(clickHoldFunc));
            const footerButton = getId('reset1Footer');
            footerButton.addEventListener('click', clickFunc);
            footerButton.addEventListener('touchstart', () => repeatFunction(clickHoldFunc));
            if (PC) { footerButton.addEventListener('mousedown', () => repeatFunction(clickHoldFunc)); }
            getId('resetCollapseFooter').addEventListener('click', collapseResetUser);

            const clickGalaxy = () => buyBuilding(3, 5);
            const galaxyButton = getId('resetGalaxyFooter');
            galaxyButton.addEventListener('click', clickGalaxy);
            galaxyButton.addEventListener('touchstart', () => repeatFunction(clickGalaxy));
            if (PC) { galaxyButton.addEventListener('mousedown', () => repeatFunction(clickGalaxy)); }
        }
    }
    for (let i = 1; i < specialHTML.longestBuilding; i++) {
        const button = getId(`building${i}Btn`);
        const clickFunc = () => buyBuilding(i);
        button.addEventListener('click', clickFunc);
        if (PC) { button.addEventListener('mousedown', () => repeatFunction(clickFunc)); }
        if (MD) { button.addEventListener('touchstart', () => repeatFunction(clickFunc)); }
    }
    {
        const button = getId('makeAllStructures');
        button.addEventListener('click', buyAll);
        if (PC) { button.addEventListener('mousedown', () => repeatFunction(buyAll)); }
        if (MD) {
            button.addEventListener('touchstart', () => repeatFunction(buyAll));
            const footer = getId('structuresFooter');
            footer.addEventListener('click', buyAll);
            footer.addEventListener('touchstart', () => repeatFunction(buyAll));
            if (PC) { footer.addEventListener('mousedown', () => repeatFunction(buyAll)); }
        }
    }
    getId('buyAnyInput').addEventListener('change', () => {
        const input = getId('buyAnyInput') as HTMLInputElement;
        player.toggles.shop.input = Math.max(Math.trunc(Number(input.value)), 0);
        input.value = format(player.toggles.shop.input, { type: 'input' });
        numbersUpdate();
    });
    getId('autoWaitInput').addEventListener('change', () => {
        const input = getId('autoWaitInput') as HTMLInputElement;
        let value = Math.max(Number(input.value), 1);
        if (isNaN(value)) { value = 2; }
        player.toggles.shop.wait[player.stage.active] = value;
        input.value = format(value, { type: 'input' });
    });

    for (let i = 0; i < global.challengesInfo.name.length; i++) {
        const image = getId(`challenge${i + 1}`);
        if (PC) { image.addEventListener('mouseover', () => hoverChallenge(i, 'challenge')); }
        if (MD) { image.addEventListener('touchstart', () => hoverChallenge(i, 'challenge')); }
        if (SR) { image.addEventListener('focus', () => hoverChallenge(i, 'challenge')); }
        image.addEventListener('click', () => { void enterExitChallengeUser(i); });
    }
    for (let i = 1; i < global.challengesInfo.rewardText[0].length; i++) {
        const image = getId(`voidReward${global.stageInfo.word[i]}`);
        image.addEventListener('click', () => hoverChallenge(i, 'reward'));
        if (MD) { image.addEventListener('click', () => (getId('voidRewardsDiv').style.display = 'block')); } //Safari bugs with no focus events
    }
    if (MD) { getId('voidRewardsDiv').addEventListener('click', () => (getId('voidRewardsDiv').style.display = '')); }

    /* Upgrade tab */
    for (let i = 0; i < specialHTML.longestUpgrade; i++) {
        const image = getId(`upgrade${i + 1}`);
        const hoverFunc = () => hoverUpgrades(i, 'upgrades');
        if (PC) { image.addEventListener('mouseover', hoverFunc); }
        if (MD) {
            image.addEventListener('touchstart', () => repeatFunction(hoverFunc, true));
        } else {
            const clickFunc = () => buyUpgrades(i, player.stage.active, 'upgrades');
            image.addEventListener('click', clickFunc);
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (SR) { image.addEventListener('focus', hoverFunc); }
    }
    for (let i = 0; i < specialHTML.longestResearch; i++) {
        const image = getId(`research${i + 1}Image`);
        const hoverFunc = () => hoverUpgrades(i, 'researches');
        if (PC) { image.addEventListener('mouseover', hoverFunc); }
        if (MD) {
            image.addEventListener('touchstart', () => repeatFunction(hoverFunc, true));
        } else {
            const clickFunc = () => buyUpgrades(i, player.stage.active, 'researches');
            image.addEventListener('click', clickFunc);
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (SR) { image.addEventListener('focus', hoverFunc); }
    }
    for (let i = 0; i < specialHTML.longestResearchExtra; i++) {
        const image = getId(`researchExtra${i + 1}Image`);
        const hoverFunc = () => hoverUpgrades(i, 'researchesExtra');
        if (PC) { image.addEventListener('mouseover', hoverFunc); }
        if (MD) {
            image.addEventListener('touchstart', () => repeatFunction(hoverFunc, true));
        } else {
            const clickFunc = () => buyUpgrades(i, player.stage.active, 'researchesExtra');
            image.addEventListener('click', clickFunc);
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (SR) { image.addEventListener('focus', hoverFunc); }
    }
    for (let i = 0; i < global.researchesAutoInfo.costRange.length; i++) {
        const image = getId(`researchAuto${i + 1}Image`);
        const hoverFunc = () => hoverUpgrades(i, 'researchesAuto');
        if (PC) { image.addEventListener('mouseover', hoverFunc); }
        if (MD) {
            image.addEventListener('touchstart', () => repeatFunction(hoverFunc, true));
        } else {
            const clickFunc = () => buyUpgrades(i, player.stage.active, 'researchesAuto');
            image.addEventListener('click', clickFunc);
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (SR) { image.addEventListener('focus', hoverFunc); }
    }
    {
        const image = getId('ASRImage');
        const hoverFunc = () => hoverUpgrades(0, 'ASR');
        if (PC) { image.addEventListener('mouseover', hoverFunc); }
        if (MD) {
            image.addEventListener('touchstart', () => repeatFunction(hoverFunc, true));
        } else {
            const clickFunc = () => buyUpgrades(0, player.stage.active, 'ASR');
            image.addEventListener('click', clickFunc);
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (SR) { image.addEventListener('focus', hoverFunc); }
    }
    if (MD) {
        const button = getId('upgradeCreate');
        const clickFunc = () => {
            const active = player.stage.active;
            const last = global.lastUpgrade[active];
            if (last[0] !== null) { buyUpgrades(last[0], active, last[1]); }
        };
        button.addEventListener('click', clickFunc);
        button.addEventListener('touchstart', () => repeatFunction(clickFunc));
        if (PC) { button.addEventListener('mousedown', () => repeatFunction(clickFunc)); }
    }

    {
        const button = getId('element0');
        const dblclickFunc = () => {
            global.lastElement = 0;
            getUpgradeDescription(0, 'elements');
        };
        if (SR) {
            getId('element1').addEventListener('keydown', (key) => {
                if (key.code === 'Tab' && key.shiftKey) {
                    const element = getId('element0');
                    element.tabIndex = 0;
                    element.ariaHidden = 'false';
                }
            });
            button.addEventListener('keydown', (key) => {
                if (key.code === 'Enter') { dblclickFunc(); }
            });
            button.addEventListener('blur', () => {
                const element = getId('element0');
                element.tabIndex = -1;
                element.ariaHidden = 'true';
            });
        }
        if (PC) { button.addEventListener('dblclick', dblclickFunc); }
        if (MD) {
            button.addEventListener('touchstart', () => {
                if (global.intervalsId.mouseRepeat !== undefined) { return; }
                global.intervalsId.mouseRepeat = setTimeout(dblclickFunc, 3000);
            });
        }
    }
    for (let i = 1; i < global.elementsInfo.startCost.length; i++) {
        const image = getId(`element${i}`);
        const clickFunc = () => buyUpgrades(i, 4, 'elements');
        if (PC) {
            image.addEventListener('mouseover', () => hoverUpgrades(i, 'elements'));
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (MD) {
            image.addEventListener('touchstart', () => {
                hoverUpgrades(i, 'elements');
                repeatFunction(clickFunc);
            });
        }
        if (SR) { image.addEventListener('focus', () => hoverUpgrades(i, 'elements')); }
        if (PC || SR) { image.addEventListener('click', clickFunc); }
    }

    /* Strangeness tab */
    for (let i = 0; i < 2; i++) {
        const strange = getId(`strange${i}`);
        const type = ['quarks', 'strangelets'][i];
        const openFunction = () => {
            if (type === 'quarks' && !player.inflation.vacuum && player.milestones[4][0] < 8) { return; }
            getId(`${type}EffectsMain`).style.display = '';
            numbersUpdate();
        };
        strange.addEventListener('click', openFunction);
        if (SR) { strange.addEventListener('focus', openFunction); }
        strange.addEventListener('blur', () => (getId(`${type}EffectsMain`).style.display = 'none'));
        getId(`${type}EffectsMain`).addEventListener('click', (event: Event) => {
            getId(`${type}EffectsMain`).style.display = 'none';
            event.stopPropagation();
        });
    }
    for (let s = 1; s < global.strangenessInfo.length; s++) {
        if (MD) { getId(`strangenessPage${s}`).addEventListener('click', () => MDStrangenessPage(s)); }
        for (let i = 0; i < global.strangenessInfo[s].startCost.length; i++) {
            const image = getId(`strange${i + 1}Stage${s}Image`);
            const hoverFunc = () => hoverStrangeness(i, s, 'strangeness');
            if (PC) { image.addEventListener('mouseover', hoverFunc); }
            if (MD) {
                image.addEventListener('touchstart', () => { /*repeatFunction(*/hoverFunc(); /*, true);*/ });
            } else {
                const clickFunc = () => buyStrangeness(i, s, 'strangeness');
                image.addEventListener('click', clickFunc);
                image.addEventListener('mousedown', () => repeatFunction(clickFunc));
            }
            if (SR) { image.addEventListener('focus', hoverFunc); }
        }
    }
    if (MD) {
        const button = getId('strangenessCreate');
        const clickFunc = () => {
            const last = global.lastStrangeness;
            if (last[0] !== null) { buyStrangeness(last[0], last[1], 'strangeness'); }
        };
        button.addEventListener('click', clickFunc);
        button.addEventListener('touchstart', () => repeatFunction(clickFunc));
        if (PC) { button.addEventListener('mousedown', () => repeatFunction(clickFunc)); }
    }
    for (let s = 1; s < global.milestonesInfo.length; s++) {
        for (let i = 0; i < global.milestonesInfo[s].need.length; i++) {
            const image = getQuery(`#milestone${i + 1}Stage${s}Div > img`);
            if (PC) { image.addEventListener('mouseover', () => hoverStrangeness(i, s, 'milestones')); }
            if (MD) { image.addEventListener('touchstart', () => hoverStrangeness(i, s, 'milestones')); }
            if (SR) {
                image.tabIndex = 0;
                image.classList.add('noFocusOutline');
                image.addEventListener('focus', () => hoverStrangeness(i, s, 'milestones'));
            }
        }
    }

    /* Inflation tab */
    for (let i = 0; i < global.inflationTreeInfo.startCost.length; i++) {
        const image = getId(`inflation${i + 1}`);
        const hoverFunc = () => hoverUpgrades(i, 'inflation');
        if (PC) { image.addEventListener('mouseover', hoverFunc); }
        if (MD) {
            image.addEventListener('touchstart', () => { /*repeatFunction(*/hoverFunc(); /*, true);*/ });
        } else {
            const clickFunc = () => buyStrangeness(i, 0, 'inflation');
            image.addEventListener('click', clickFunc);
            image.addEventListener('mousedown', () => repeatFunction(clickFunc));
        }
        if (SR) { image.addEventListener('focus', hoverFunc); }
    }
    getId('inflationRefund').addEventListener('click', inflationRefund);
    if (MD) {
        const button = getId('inflationActivate');
        const clickFunc = () => {
            if (global.lastInflation !== null) { buyStrangeness(global.lastInflation, 0, 'inflation'); }
        };
        button.addEventListener('click', clickFunc);
        button.addEventListener('touchstart', () => repeatFunction(clickFunc));
        if (PC) { button.addEventListener('mousedown', () => repeatFunction(clickFunc)); }
    }

    /* Settings tab */
    getId('vaporizationInput').addEventListener('change', () => {
        const input = getId('vaporizationInput') as HTMLInputElement;
        player.vaporization.input[0] = Math.max(Number(input.value), 0);
        input.value = format(player.vaporization.input[0], { type: 'input' });
    });
    getId('vaporizationInputMax').addEventListener('change', () => {
        const input = getId('vaporizationInputMax') as HTMLInputElement;
        player.vaporization.input[1] = Math.max(Number(input.value), 0);
        input.value = format(player.vaporization.input[1], { type: 'input' });
    });
    getId('collapseStarsInput').addEventListener('change', () => {
        const input = getId('collapseStarsInput') as HTMLInputElement;
        player.collapse.input[0] = Math.max(Number(input.value), 1);
        input.value = format(player.collapse.input[0], { type: 'input' });
    });
    getId('collapseStarsInputWait').addEventListener('change', () => {
        const input = getId('collapseStarsInputWait') as HTMLInputElement;
        player.collapse.input[1] = Number(input.value);
        input.value = format(player.collapse.input[1], { type: 'input' });
    });
    getId('stageInput').addEventListener('change', () => {
        const input = getId('stageInput') as HTMLInputElement;
        player.stage.input = Math.max(Number(input.value), 0);
        input.value = format(player.stage.input, { type: 'input' });
    });
    getId('versionButton').addEventListener('click', () => {
        buildVersionInfo();
        getId('versionInfo').style.display = '';
    });
    getId('save').addEventListener('click', () => { void saveGame(); });
    getId('file').addEventListener('change', async() => {
        const id = getId('file') as HTMLInputElement;
        loadGame(await (id.files as FileList)[0].text());
        id.value = '';
    });
    getId('export').addEventListener('click', exportFileGame);
    getId('saveConsole').addEventListener('click', saveConsole);
    if (MD) {
        getId('currentTheme').addEventListener('click', () => getId('themeArea').classList.add('windowOpen'));
        getId('themeArea').addEventListener('mouseleave', () => getId('themeArea').classList.remove('windowOpen'));
    }
    getId('switchTheme0').addEventListener('click', () => setTheme(null));
    for (let i = 1; i < global.stageInfo.word.length; i++) {
        getId(`switchTheme${i}`).addEventListener('click', () => setTheme(i));
    }
    getId('saveFileNameInput').addEventListener('change', () => {
        const input = getId('saveFileNameInput') as HTMLInputElement;
        const testValue = input.value; //.replaceAll(/[\\/:*?"<>|]/g, '_');
        if (testValue.length < 1) { return void (input.value = playerStart.fileName); }

        try {
            btoa(testValue); //Test for any illegal characters
            player.fileName = testValue;
            //input.value = testValue;
        } catch (error) {
            void Alert(`Save file name is not allowed\n${error}`);
        }
    });
    {
        const button = getId('saveFileHoverButton');
        const hoverFunc = () => (getId('saveFileNamePreview').textContent = replaceSaveFileSpecials());
        button.addEventListener('mouseover', hoverFunc);
        if (SR) { button.addEventListener('focus', hoverFunc); }
    }
    getId('mainInterval').addEventListener('change', () => {
        const mainInput = getId('mainInterval') as HTMLInputElement;
        globalSave.intervals.main = Math.min(Math.max(Math.trunc(Number(mainInput.value)), 20), 100);
        mainInput.value = `${globalSave.intervals.main}`;
        saveGlobalSettings();
        changeIntervals();
    });
    getId('numbersInterval').addEventListener('change', () => {
        const numberInput = getId('numbersInterval') as HTMLInputElement;
        globalSave.intervals.numbers = Math.min(Math.max(Math.trunc(Number(numberInput.value)), 40), 200);
        numberInput.value = `${globalSave.intervals.numbers}`;
        saveGlobalSettings();
        changeIntervals();
    });
    getId('visualInterval').addEventListener('change', () => {
        const visualInput = getId('visualInterval') as HTMLInputElement;
        globalSave.intervals.visual = Math.min(Math.max(Math.trunc(Number(visualInput.value) * 100), 20), 400) * 10;
        visualInput.value = `${globalSave.intervals.visual / 1000}`;
        saveGlobalSettings();
        changeIntervals();
    });
    getId('autoSaveInterval').addEventListener('change', () => {
        const autoSaveInput = getId('autoSaveInterval') as HTMLInputElement;
        globalSave.intervals.autoSave = Math.min(Math.max(Math.trunc(Number(autoSaveInput.value)), 4), 1800) * 1000;
        autoSaveInput.value = `${globalSave.intervals.autoSave / 1000}`;
        saveGlobalSettings();
        changeIntervals();
    });
    getId('thousandSeparator').addEventListener('change', () => changeFormat(false));
    getId('decimalPoint').addEventListener('change', () => changeFormat(true));
    getId('MDToggle0').addEventListener('click', () => toggleSpecial(0, 'mobile', true, true));
    getId('SRToggle0').addEventListener('click', () => toggleSpecial(0, 'reader', true, true));
    getId('reviewEvents').addEventListener('click', replayEvent);
    getId('customFontSize').addEventListener('change', () => changeFontSize(false));

    getId('stageResetsSave').addEventListener('change', () => {
        const inputID = getId('stageResetsSave') as HTMLInputElement;
        player.history.stage.input[0] = Math.min(Math.max(Math.trunc(Number(inputID.value)), 0), 100);
        inputID.value = `${player.history.stage.input[0]}`;
    });
    getId('stageResetsShow').addEventListener('change', () => {
        const input = getId('stageResetsShow') as HTMLInputElement;
        player.history.stage.input[1] = Math.min(Math.max(Math.trunc(Number(input.value)), 4), 100);
        input.value = `${player.history.stage.input[1]}`;
        global.debug.historyStage = null;
        visualUpdate();
    });

    /* Footer */
    {
        const toggle = getId('hideToggle');
        if (MD) {
            const timeoutFunc = () => {
                if (!global.footer) { return hideFooter(); }
                if (global.intervalsId.mouseRepeat !== undefined) { return; }
                global.intervalsId.mouseRepeat = setTimeout(hideFooter, 400);
            };
            toggle.addEventListener('touchstart', timeoutFunc);
            if (PC) { toggle.addEventListener('mousedown', timeoutFunc); }
        } else { toggle.addEventListener('click', hideFooter); }
    }
    for (const tabText of global.tabList.tabs) {
        getId(`${tabText}TabBtn`).addEventListener('click', () => switchTab(tabText));
        for (const subtabText of global.tabList[`${tabText}Subtabs`]) {
            getId(`${tabText}SubtabBtn${subtabText}`).addEventListener('click', () => switchTab(tabText, subtabText));
        }
    }
    for (let i = 1; i < global.stageInfo.word.length; i++) {
        getId(`${global.stageInfo.word[i]}Switch`).addEventListener('click', () => switchStage(i));
    }

    /* Post */
    document.head.append(specialHTML.styleSheet);
    if (globalSave.theme !== null) { setTheme(globalSave.theme); }
    stageUpdate('reload');
    if (save !== null) {
        global.lastSave = handleOfflineTime();
        Notify(`Welcome back, you were away for ${format(global.lastSave, { type: 'time', padding: false })}${oldVersion !== player.version ? `\nGame have been updated from ${oldVersion} to ${player.version}` : ''}${globalSave.developerMode ?
            `\nGame loaded after ${format((Date.now() - playerStart.time.started) / 1000, { type: 'time', padding: false })}` : ''}
        `);
        void simulateOffline(global.lastSave);
    } else {
        global.paused = false;
        changeIntervals();
    }
    getId('body').style.display = '';
    getId('loading').style.display = 'none';
    document.title = `Fundamental ${playerStart.version}`;
} catch (error) {
    const stack = (error as { stack: string }).stack;
    void Alert(`Game failed to load\n${typeof stack === 'string' ? stack.replaceAll(`${window.location.origin}/`, '') : error}`, 2);
    document.body.style.userSelect = '';
    const buttonDiv = document.createElement('div');
    buttonDiv.innerHTML = '<button type="button" id="exportError" style="width: 7em;">Export save</button><button type="button" id="deleteError" style="width: 7em;">Delete save</button>';
    buttonDiv.style.cssText = 'display: flex; column-gap: 0.6em; margin-top: 0.4em;';
    getId('loading').append(buttonDiv);
    let exported = false;
    getId('exportError').addEventListener('click', () => {
        exported = true;
        const save = localStorage.getItem('testing_save');
        if (save === null) { return void Alert('No save file detected'); }
        const a = document.createElement('a');
        a.href = `data:text/plain,${save}`;
        a.download = 'Fundamental post error export';
        a.click();
    });
    getId('deleteError').addEventListener('click', async() => {
        if (!exported && !await Confirm("Recommended to export save file first\nPress 'Confirm' to confirm and delete your save file")) { return; }
        localStorage.removeItem('testing_save');
        window.location.reload();
        void Alert('Awaiting game reload');
    });
    throw error;
}
