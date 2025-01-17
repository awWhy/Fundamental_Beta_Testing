import { checkTab, milestoneGetValue } from './Check';
import Overlimit from './Limit';
import { getClass, getId, getQuery } from './Main';
import { effectsCache, global, logAny, player } from './Player';
import { Notify, SRHotkeysInfo, globalSave, playEvent, setTheme, specialHTML } from './Special';
import { calculateBuildingsCost, stageResetCheck, toggleSwap, switchStage, setActiveStage, calculateEffects, assignBuildingsProduction, assignResetInformation } from './Stage';
import type { gameTab } from './Types';

export const switchTab = (tab: gameTab, subtab = null as null | string) => {
    if (subtab === null) {
        const oldTab = global.tab;
        getId(`${oldTab}Tab`).style.display = 'none';
        getId(`${oldTab}TabBtn`).classList.remove('tabActive');
        for (const inside of global.tabList[`${oldTab}Subtabs`]) {
            getId(`${oldTab}SubtabBtn${inside}`).style.display = 'none';
        }

        global.tab = tab;
        let subtabAmount = 0;
        getId(`${tab}Tab`).style.display = '';
        getId(`${tab}TabBtn`).classList.add('tabActive');
        for (const inside of global.tabList[`${tab}Subtabs`]) {
            if (checkTab(tab, inside)) {
                getId(`${tab}SubtabBtn${inside}`).style.display = '';
                subtabAmount++;
            } else if (global.subtab[`${tab}Current`] === inside) {
                switchTab(tab, global.tabList[`${tab}Subtabs`][0]);
            }
        }
        getId('subtabs').style.display = subtabAmount > 1 ? '' : 'none';
        if (globalSave.SRSettings[0]) { getId('SRTab').textContent = `Current tab is '${tab}'${subtabAmount > 1 ? ` and subtab is '${global.subtab[`${tab}Current`]}'` : ''}`; }
    } else {
        const oldSubtab = global.subtab[`${tab}Current`];
        getId(`${tab}Subtab${oldSubtab}`).style.display = 'none';
        getId(`${tab}SubtabBtn${oldSubtab}`).classList.remove('tabActive');

        global.subtab[`${tab as Exclude<gameTab, 'Elements'>}Current`] = subtab;
        getId(`${tab}Subtab${subtab}`).style.display = '';
        getId(`${tab}SubtabBtn${subtab}`).classList.add('tabActive');
        if (global.tab !== tab) { return; }
        if (globalSave.SRSettings[0]) { getId('SRTab').textContent = `Current subtab is '${subtab}', part of '${tab}' tab`; }
    }

    const active = player.stage.active;
    if ((tab === 'upgrade' && global.subtab.upgradeCurrent === 'Elements') || tab === 'Elements') {
        if (active !== 4 && active !== 5) {
            if (tab === 'upgrade' && subtab === null) {
                switchTab('upgrade', 'Upgrades');
            } else {
                setActiveStage(global.trueActive === 5 ? 5 : 4, global.trueActive);
                stageUpdate();
            }
            return;
        }
    } else if (tab === 'inflation') {
        if (active !== 6) {
            setActiveStage(6, global.trueActive);
            stageUpdate();
            return;
        }
    } else if (global.trueActive !== active) {
        switchStage(global.trueActive);
        return;
    }
    if (!global.offline.active) {
        visualUpdate();
        numbersUpdate();
    }
};

export const numbersUpdate = () => {
    const { tab, subtab } = global;
    const active = player.stage.active;
    const buildings = player.buildings[active];
    const vacuum = player.inflation.vacuum;

    if (!global.debug.timeLimit) {
        const challenge = player.challenges.active;
        let noTime = null as boolean | null;
        if (vacuum) {
            if (challenge !== null) { noTime = player.time[global.challengesInfo.resetType[challenge]] > global.challengesInfo.time[challenge]; }
        } else if (player.inflation.tree[4] < 1 && (player.stage.true >= 7 || player.stage.resets >= 4)) {
            const s = Math.min(player.stage.current, 4);
            const info = global.milestonesInfo;
            let maxTime = 0;
            for (let i = 0; i < info[s].need.length; i++) {
                if (player.milestones[s][i] >= info[s].max[i]) {
                    if (s === 4 && player.milestones[5][i] < info[5].max[i]) {
                        maxTime = Math.max(info[5].time[i], maxTime);
                    }
                    continue;
                }
                maxTime = Math.max(info[s].time[i], maxTime);
            }
            if (maxTime > 0) { noTime = player.time.stage > maxTime; }
        }

        if (noTime) {
            Notify(`Time limit has been reached for ${challenge !== null ? global.challengesInfo.name[challenge] : 'all Milestones'}`);
            global.debug.timeLimit = true;
        } else if (noTime === null) { global.debug.timeLimit = true; }
    }

    if (global.footer) {
        if (active === 1) {
            getId('footerStat1Span').textContent = format(buildings[0].current, { padding: true });
            getId('footerStat2Span').textContent = format(player.discharge.energy, { padding: 'exponent' });
        } else if (active === 2) {
            getId('footerStat1Span').textContent = format(buildings[0].current, { padding: true });
            getId('footerStat2Span').textContent = format(buildings[1].current, { padding: true });
            getId('footerStat3Span').textContent = format(player.vaporization.clouds, { padding: true });
        } else if (active === 3) {
            getId('footerStat1Span').textContent = format(buildings[0].current, { padding: true });
        } else if (active === 4 || active === 5) {
            const stars = player.buildings[4];

            getId('footerStat1Span').textContent = format(player.collapse.mass, { padding: true });
            getId('footerStat2Span').textContent = format(stars[0].current, { padding: true });
            if (active === 5) {
                getId('footerStat3Span').textContent = format(new Overlimit(stars[1].current).plus(stars[2].current, stars[3].current, stars[4].current, stars[5].current), { padding: true });
            }
        } else if (active === 6) {
            getId('footerStat1Span').textContent = format(buildings[0].current, { padding: true });
            getId('footerStat2Span').textContent = format(player.cosmon.current, { padding: 'exponent' });
        }
    }
    if (tab === 'stage') {
        if (subtab.stageCurrent === 'Structures') {
            const { buildingsInfo } = global;
            const producing = buildingsInfo.producing[active];
            const howMany = global.hotkeys.shift ? (global.hotkeys.ctrl ? 100 : 1) : global.hotkeys.ctrl ? 10 : player.toggles.shop.input;
            const speed = global.inflationInfo.globalSpeed;

            //Visual fixes for stuff that makes no sense to assign
            if (active === 1) {
                if (vacuum) { assignBuildingsProduction.S1Build1(false, true); }
            } else if (active === 2) {
                assignBuildingsProduction.S2Build2(true);
            } else if (active === 3) {
                if (vacuum) { assignBuildingsProduction.stage3Cache(true); }
                assignBuildingsProduction.S3Build1(false, true);
                assignBuildingsProduction.S3Build2(true);
                assignBuildingsProduction.S3Build3(true);
            }
            for (let i = 1; i < buildingsInfo.maxActive[active]; i++) {
                const trueCountID = getId(`building${i}True`);
                getId(`building${i}Cur`).textContent = format(buildings[i].current, { padding: trueCountID.style.display !== 'none' });
                getId(`building${i}Prod`).textContent = format(buildingsInfo.type[active][i - 1] === 'producing' ? new Overlimit(producing[i]).multiply(speed) : producing[i], { padding: true });
                trueCountID.textContent = `[${format(buildings[i as 1].true, { padding: 'exponent' })}]`;

                let lockText;
                if (active === 3) {
                    if (i > 1 && player.upgrades[3][global.accretionInfo.unlockA[i - 2]] !== 1) {
                        lockText = 'Unlocked with Upgrade';
                    }
                } else if (active === 4) {
                    if (i === 5 && player.challenges.active === 0 && player.inflation.tree[3] < 1) {
                        lockText = "Can't be created inside Void";
                    } else if (player.researchesExtra[5][0] < 1 && player.collapse.mass < global.collapseInfo.unlockB[i]) {
                        lockText = `Unlocked at ${format(global.collapseInfo.unlockB[i])} Mass`;
                    }
                } else if (active === 6) {
                    if (!player.inflation.vacuum) {
                        lockText = 'Requires true Vacuum state';
                    }
                }
                if (lockText !== undefined) {
                    getId(`building${i}`).classList.remove('availableBuilding');
                    getId(`building${i}Btn`).textContent = lockText;
                    getId(`building${i}BuyX`).textContent = 'Locked';
                    continue;
                }

                let costName: string;
                let currency: number | Overlimit;
                let free = false;
                let multi = true;
                if (active === 6) { //Universe
                    costName = 'Groups';
                    currency = player.merge.reward[0];
                    multi = false;
                } else if (active === 5 && i === 3) { //Galaxy
                    costName = 'Mass';
                    currency = player.collapse.mass;
                    multi = false;
                } else {
                    let e = i - 1;
                    let extra = active;
                    if (active === 1) {
                        if (i === 1 && vacuum) { free = player.researchesExtra[1][2] >= 1 && player.strangeness[1][8] >= 1; }
                    } else if (active === 2) {
                        if (i !== 1) { e = 1; }
                    } else if (active >= 3) {
                        e = 0;
                        if (active === 5) { extra = 4; }
                    }

                    costName = buildingsInfo.name[extra][e];
                    currency = player.buildings[extra][e].current;
                }

                let buy = 1;
                const cost = calculateBuildingsCost(i, active);
                if (howMany !== 1 && multi) {
                    const scaling = buildingsInfo.increase[active][i];
                    if (free) {
                        buy = howMany <= 0 ? Math.max(Math.floor(new Overlimit(currency).divide(cost).log(scaling).toNumber()) + 1, 1) : howMany;
                        if (buy > 1) { cost.multiply(new Overlimit(scaling).power(buy - 1)); }
                    } else {
                        buy = howMany <= 0 ? Math.max(Math.floor(new Overlimit(currency).multiply(scaling - 1).divide(cost).plus('1').log(scaling).toNumber()), 1) : howMany;
                        if (buy > 1) { cost.multiply(new Overlimit(scaling).power(buy).minus('1').divide(scaling - 1)); }
                    }
                }

                getId(`building${i}`).classList[cost.lessOrEqual(currency) ? 'add' : 'remove']('availableBuilding');
                getId(`building${i}Btn`).textContent = `Need: ${format(cost, { padding: true })} ${costName}`;
                getId(`building${i}BuyX`).textContent = format(buy, { padding: 'exponent' });
            }
            if (active === 1) {
                const { dischargeInfo } = global;
                getId('reset1Button').textContent = `Next goal is ${format(dischargeInfo.next, { padding: 'exponent' })} Energy`;
                getQuery('#tritiumEffect > span').textContent = format(new Overlimit(effectsCache.tritium).multiply(speed), { padding: true });
                getQuery('#dischargeEffect > span').textContent = format(new Overlimit(effectsCache.dischargeBase).power(dischargeInfo.total), { padding: true });
                getQuery('#energySpent > span').textContent = format(dischargeInfo.energyTrue - player.discharge.energy, { padding: 'exponent' });
                if (vacuum) {
                    const preonCap = calculateEffects.preonsHardcap(calculateEffects.effectiveEnergy() ** calculateEffects.S1Extra3());
                    getQuery('#preonCap > span').textContent = format(preonCap * speed, { padding: true });
                    getId('preonCapRatio').textContent = format(assignBuildingsProduction.S1Build1(true) / preonCap, { padding: true });
                }
            } else if (active === 2) {
                getId('reset1Button').textContent = `Reset for ${format(global.vaporizationInfo.get, { padding: true })} Clouds`;
                getQuery('#cloudEffect > span').textContent = format(calculateEffects.clouds(), { padding: true });
                if (vacuum) {
                    getQuery('#molesProduction > span').textContent = format(new Overlimit(effectsCache.tritium).divide(6.02214076e23 / speed), { padding: true });
                }

                const rainNow = calculateEffects.S2Extra1(player.researchesExtra[2][1]);
                const rainAfter = calculateEffects.S2Extra1(player.researchesExtra[2][1], true);
                const storm = calculateEffects.S2Extra2(rainAfter) / calculateEffects.S2Extra2(rainNow);
                getQuery('#vaporizationBoostTotal > span').textContent = format(calculateEffects.clouds(true).divide(calculateEffects.clouds()).toNumber() * (rainAfter / rainNow) * storm, { padding: true });
            } else if (active === 3) {
                getQuery('#dustSoftcap > span').textContent = format(global.accretionInfo.dustSoft);
                if (player.accretion.rank < global.accretionInfo.maxRank) {
                    if (player.challenges.active === 0 && player.accretion.rank >= 6) {
                        const scaling = buildingsInfo.increase[5][3];
                        getId('reset1Button').textContent = `Requires ${format(logAny(global.accretionInfo.rankCost[player.accretion.rank] / 1.98847e38 * (scaling - 1) + 1, scaling) - player.buildings[5][3].true, { padding: true })} more Galaxies`;
                    } else if (player.strangeness[3][4] >= 2) {
                        getId('reset1Button').textContent = `Next Rank after ${format(Math.max(global.accretionInfo.rankCost[player.accretion.rank] - buildings[0].total.toNumber(), 0), { padding: true })} Mass`;
                    }
                }
                if (vacuum) {
                    const dustCap = calculateEffects.dustHardcap();
                    getQuery('#massProduction > span').textContent = format(assignBuildingsProduction.S1Build1() * 1.78266192e-33 * speed, { padding: true });
                    getQuery('#dustCap > span').textContent = format(dustCap, { padding: true });
                    getId('dustCapRatio').textContent = format(assignBuildingsProduction.S3Build1(true) / dustCap, { padding: true });
                    getQuery('#submersionBoost > span').textContent = format(calculateEffects.submersion(), { padding: true });
                }
            } else if (active === 4 || active === 5) {
                const { collapseInfo } = global;
                const calculateStar = calculateEffects.star;
                const starEffect = [calculateStar[0](), effectsCache.star1, calculateStar[2]()];
                const starProd = buildingsInfo.producing[4];
                let total = (calculateEffects.mass(true) / effectsCache.mass) * (calculateEffects.S4Research4(true) / calculateEffects.S4Research4()) * ((1 + (calculateEffects.S5Upgrade2(true) - effectsCache.S5Upgrade2) / effectsCache.galaxyBase) ** (player.buildings[5][3].true * 2));
                if (player.strangeness[4][4] < 2) {
                    const restProd = new Overlimit(starProd[1]).plus(starProd[3], starProd[4], starProd[5]);
                    total *= new Overlimit(starProd[2]).multiply(calculateStar[0](true) / starEffect[0]).plus(restProd).divide(restProd.plus(starProd[2])).replaceNaN('1').toNumber() * (calculateStar[1](true) / starEffect[1]) * (calculateStar[2](true) / starEffect[2]);
                }

                if (active === 4) {
                    getId('reset1Button').textContent = `Collapse is at ${format(collapseInfo.newMass, { padding: true })} Mass`;
                    getQuery('#solarMassEffect > span').textContent = format(effectsCache.mass, { padding: true });
                    for (let i = 0; i < 3; i++) {
                        getId(`special${i + 1}Cur`).textContent = format(player.collapse.stars[i], { padding: 'exponent' });
                        getId(`special${i + 1}Get`).textContent = format(collapseInfo.starCheck[i], { padding: 'exponent' });
                        getQuery(`#star${i + 1}Effect > span`).textContent = format(starEffect[i], { padding: true });
                    }
                    getQuery('#collapseBoostTotal > span').textContent = format(total, { padding: true });
                    if (vacuum) {
                        getQuery('#mainCap > span').textContent = format(collapseInfo.solarCap, { padding: true });
                        getId('mainCapTill').textContent = format(collapseInfo.timeUntil, { padding: true });
                    }
                } else if (active === 5) {
                    if (vacuum) {
                        assignResetInformation.mergeReward();
                        const mergeEffects = [calculateEffects.reward[0]()];
                        const remaining = calculateEffects.mergeMaxResets() - player.merge.resets;
                        getId('reset1Button').textContent = `Can reset ${remaining} more time${remaining !== 1 ? 's' : ''}`;
                        for (let i = 0; i < 1; i++) {
                            getId(`special${i + 1}Cur`).textContent = format(player.merge.reward[i], { padding: 'exponent' });
                            getId(`special${i + 1}Get`).textContent = format(global.mergeInfo.checkReward[i], { padding: 'exponent' });
                            getQuery(`#merge${i + 1}Effect > span`).textContent = format(mergeEffects[i], { padding: true });
                        }
                        getQuery('#mainCapS5 > span').textContent = format(collapseInfo.solarCap, { padding: true });
                        getQuery('#mergeBoostTotal > span').textContent = format((buildings[3].true / (global.mergeInfo.galaxies + 1) + 1) * (calculateEffects.reward[0](true) / mergeEffects[0]), { padding: true });
                    }
                    getQuery('#elementsProductionS5 > span').textContent = format(new Overlimit(starProd[1]).plus(starProd[2], starProd[3], starProd[4], starProd[5]).multiply(speed), { padding: true });
                    getQuery('#collapseBoostTotalS5 > span').textContent = format(total, { padding: true });
                    getQuery('#mainCapCurrentS5 > span').textContent = format(collapseInfo.newMass, { padding: true });
                }
            } else if (active === 6) {
                getQuery('#globalSpeed > span').textContent = format(global.inflationInfo.globalSpeed, { padding: true });
                getId('cosmonGainTrue').textContent = format(buildings[1].true + 1, { padding: 'exponent' });
                getQuery('#universeTime > span').textContent = format(player.inflation.age, { type: 'time' });
                getQuery('#universeTimeReal > span').textContent = format(player.time.universe, { type: 'time' });
            }

            if (!vacuum && (active >= 6 ? player.stage.current : active) < 4) {
                getId('stageReward').textContent = format(calculateEffects.strangeGain(false), { padding: true });
                if (active < 4) { getId('stageReset').textContent = stageResetCheck(active) ? 'Requirements are met' : `Requires ${active === 3 ? `${format(2.45576045e31)} Mass` : active === 2 ? `${format(1.19444e29)} Drops` : `${format(1.67133125e21)} Molecules`}`; }
            } else { getId('stageReward').textContent = format(global.strangeInfo.quarksGain, { padding: true }); }
            getQuery('#stageTime > span').textContent = format(player.stage.time, { type: 'time' });
            getQuery('#stageTimeReal > span').textContent = format(player.time.stage, { type: 'time' });
        } else if (subtab.stageCurrent === 'Advanced') {
            getChallengeDescription(global.lastChallenge[0]);
            getChallengeReward(global.lastChallenge[1]);
        }
    } else if (tab === 'upgrade' || tab === 'Elements') {
        const trueSubtab = tab === 'Elements' ? tab : subtab.upgradeCurrent;
        if (trueSubtab === 'Upgrades') {
            getUpgradeDescription(global.lastUpgrade[active][0], global.lastUpgrade[active][1]);
        } else if (trueSubtab === 'Elements') {
            if (global.lastElement !== 0) { getUpgradeDescription(global.lastElement, 'elements'); }
        }
    } else if (tab === 'strangeness') {
        if (subtab.strangenessCurrent === 'Matter') {
            const interstellar = vacuum || (active >= 6 ? player.stage.current : active) >= 4;
            const quarksGain = interstellar ? global.strangeInfo.quarksGain : calculateEffects.strangeGain(false);
            getId('strange0Gain').textContent = format(quarksGain, { padding: true });
            getId('strange1Gain').textContent = format(calculateEffects.strangeGain(interstellar, 1), { padding: true });
            getId('strangeRate').textContent = format(quarksGain / player.time.stage, { type: 'income' });
            getId('strangePeak').textContent = interstellar ? format(player.stage.peak, { type: 'income' }) : 'Interstellar Stage only';
            getId('strange0Cur').textContent = format(player.strange[0].current, { padding: true });
            getId('strange1Cur').textContent = format(player.strange[1].current, { padding: true });
            getId('stageTimeStrangeness').textContent = format(player.time.stage, { type: 'time' });
            getId('stageTimeBestReset').textContent = format(player.history.stage.best[0], { type: 'time' });
            if (getId('strange1EffectsMain').style.display === '') { //Slow, but probably better than nothing
                const information = global.strangeInfo.strangeletsInfo;
                getId('strange1Effect1Stat0').textContent = format(information[0] * 100, { padding: true });
                if (interstellar) { getId('strange1Effect1Stat1').textContent = format(stageResetCheck(5) ? information[0] * quarksGain / player.time.stage : 0, { type: 'income' }); }
                getId('strange1Effect2Stat').textContent = format(information[1], { padding: true });
            }
            if (getId('strange0EffectsMain').style.display === '') {
                const { stageBoost } = global.strangeInfo;
                const { strangeness } = player;

                getId('strange0Effect1Stat').textContent = format(strangeness[1][6] >= 1 ? stageBoost[1] : 1, { padding: true });
                getId('strange0Effect2Stat').textContent = format(strangeness[2][6] >= 1 ? stageBoost[2] : 1, { padding: true });
                getId('strange0Effect3Stat').textContent = format(strangeness[3][7] >= 1 ? stageBoost[3] : 1, { padding: true });
                getId('strange0Effect4Stat').textContent = format(strangeness[4][7] >= 1 ? stageBoost[4] : 1, { padding: true });
                getId('strange0Effect5Stat').textContent = format(strangeness[5][7] >= 1 ? stageBoost[5] : 1, { padding: true });
            }
            getStrangenessDescription(global.lastStrangeness[0], global.lastStrangeness[1], 'strangeness');
        } else if (subtab.strangenessCurrent === 'Milestones') {
            const { milestonesInfo: info } = global;
            const time = player.time[player.challenges.active === 0 && player.challenges.super ? 'vacuum' : 'stage'];
            const timeLimited = vacuum || player.inflation.tree[4] < 1;
            for (let s = 1; s < info.length; s++) {
                for (let i = 0; i < info[s].need.length; i++) {
                    getId(`milestone${i + 1}Stage${s}Current`).textContent = format(milestoneGetValue(i, s), { padding: true });
                    getId(`milestone${i + 1}Stage${s}Required`).textContent = !vacuum && player.milestones[s][i] >= info[s].max[i] ? 'Maxed' :
                        timeLimited && time > info[s].time[i] ? 'No time' : format(info[s].need[i], { padding: true });
                }
            }
            getStrangenessDescription(global.lastMilestone[0], global.lastMilestone[1], 'milestones');
        }
    } else if (tab === 'inflation') {
        if (subtab.inflationCurrent === 'Researches') {
            getUpgradeDescription(global.lastInflation, 'inflation');
        }
    } else if (tab === 'settings') {
        if (subtab.settingsCurrent === 'Settings') {
            const exportReward = player.time.export;
            const conversion = Math.min(exportReward[0] / 86400, 1);
            getId('exportQuarks').textContent = format((exportReward[1] / 2.5 + 1) * conversion, { padding: true });
            getId('exportStrangelets').textContent = format(exportReward[2] / 2.5 * conversion, { padding: true });
            if (global.lastSave >= 1) { getId('isSaved').textContent = `${format(global.lastSave, { type: 'time' })} ago`; }
        } else if (subtab.settingsCurrent === 'Stats') {
            getId('firstPlayAgo').textContent = format((Date.now() - player.time.started) / 1000, { type: 'time' });
            getId('onlineTotal').textContent = format(player.time.online, { type: 'time' });
            getQuery('#stageResets > span').textContent = `${player.stage.resets}`;

            const exportReward = player.time.export;
            getId('exportQuarksMax').textContent = format(exportReward[1] / 2.5 + 1, { padding: true });
            getId('exportStrangeletsMax').textContent = format(exportReward[2] / 2.5, { padding: true });
            getId('exportTimeToMax').textContent = format(86400 - exportReward[0], { type: 'time' });
            getId('exportQuarksStorage').textContent = format(exportReward[1], { padding: true });
            getId('exportStrangeletsStorage').textContent = format(exportReward[2], { padding: true });
            if (active === 1) {
                const { dischargeInfo } = global;
                getQuery('#dischargeStat > span').textContent = format(dischargeInfo.total);
                getId('dischargeStatTrue').textContent = ` [${player.discharge.current}]`;
                getQuery('#dischargeScaleStat > span').textContent = format(dischargeInfo.scaling);
                for (let s = 1; s <= (vacuum ? 5 : 1); s++) {
                    const buildings = player.buildings[s];
                    const energyType = dischargeInfo.energyType[s];
                    for (let i = 1; i < global.buildingsInfo.maxActive[s]; i++) {
                        getQuery(`#energyGainStage${s}Build${i + (vacuum ? 0 : 2)} > span`).textContent = format(energyType[i] * buildings[i as 1].true, { padding: 'exponent' });
                        getId(`energyGainStage${s}Build${i + (vacuum ? 0 : 2)}Per`).textContent = format(energyType[i]);
                    }
                }
                getQuery('#effectiveEnergyStat > span').textContent = format(calculateEffects.effectiveEnergy(), { padding: true });
                getQuery('#maxEnergyStat > span').textContent = format(player.discharge.energyMax, { padding: 'exponent' });
            } else if (active === 2) {
                const clouds = calculateEffects.clouds(true).divide(calculateEffects.clouds()).toNumber();
                getQuery('#cloudStat > span').textContent = format(clouds, { padding: true });
                const rainNow = calculateEffects.S2Extra1(player.researchesExtra[2][1]);
                const rainAfter = calculateEffects.S2Extra1(player.researchesExtra[2][1], true);
                const rain = rainAfter / rainNow;
                const storm = calculateEffects.S2Extra2(rainAfter) / calculateEffects.S2Extra2(rainNow);
                getQuery('#rainStat > span').textContent = format(rain, { padding: true });
                getQuery('#stormStat > span').textContent = format(storm, { padding: true });
                getId('cloudEffectTotal').textContent = format(clouds * rain * storm, { padding: true });
                getQuery('#maxCloudStat > span').textContent = format(player.vaporization.cloudsMax, { padding: true });

                if (vacuum) {
                    buildings[0].total.setValue(player.buildings[1][5].total).divide('6.02214076e23');
                    buildings[0].trueTotal.setValue(player.buildings[1][5].trueTotal).divide('6.02214076e23');
                }
            } else if (active === 3) {
                getId('currentRank').textContent = format(global.accretionInfo.effective);
                getId('currentRankTrue').textContent = ` [${player.accretion.rank}]`;
                if (vacuum) {
                    buildings[0].trueTotal.setValue(player.buildings[1][0].trueTotal).multiply('1.78266192e-33');
                }
            } else if (active === 4 || active === 5) {
                getQuery('#maxSolarMassStat > span').textContent = format(player.collapse.massMax, { padding: true });
                if (active === 4) {
                    const auto2 = player.strangeness[4][4] >= 2;
                    const calculateStar = calculateEffects.star;
                    const mass = calculateEffects.mass(true) / effectsCache.mass;
                    getQuery('#solarMassStat > span').textContent = format(mass, { padding: true });
                    let star0 = 1;
                    if (!auto2) {
                        const starProd = global.buildingsInfo.producing[4];
                        const restProd = new Overlimit(starProd[1]).plus(starProd[3], starProd[4], starProd[5]);
                        star0 = new Overlimit(starProd[2]).multiply(calculateStar[0](true) / calculateStar[0]()).plus(restProd).divide(restProd.plus(starProd[2])).replaceNaN('1').toNumber();
                    }
                    const star1 = auto2 ? 1 : calculateStar[1](true) / effectsCache.star1;
                    const star2 = auto2 ? 1 : calculateStar[2](true) / calculateStar[2]();
                    if (!auto2) {
                        getQuery('#star1Stat > span').textContent = format(star0, { padding: true });
                        getQuery('#star2Stat > span').textContent = format(star1, { padding: true });
                        getQuery('#star3Stat > span').textContent = format(star2, { padding: true });
                    }
                    const gamma = calculateEffects.S4Research4(true) / calculateEffects.S4Research4();
                    getQuery('#gammaRayStat > span').textContent = format(gamma, { padding: true });
                    const quasar = (1 + (calculateEffects.S5Upgrade2(true) - effectsCache.S5Upgrade2) / effectsCache.galaxyBase) ** player.buildings[5][3].true;
                    getQuery('#quasarStat > span').textContent = format(quasar, { padding: true });
                    getId('starTotal').textContent = format(mass * star0 * star1 * star2 * gamma * (quasar ** 2), { padding: true });
                } else if (active === 5) {
                    getId('trueStarsStat').textContent = format(global.collapseInfo.trueStars, { padding: 'exponent' });
                    const stars = player.buildings[4];
                    buildings[0].current.setValue(stars[1].current).plus(stars[2].current, stars[3].current, stars[4].current, stars[5].current);
                    buildings[0].total.setValue(stars[1].total).plus(stars[2].total, stars[3].total, stars[4].total, stars[5].total);
                    buildings[0].trueTotal.setValue(stars[1].trueTotal).plus(stars[2].trueTotal, stars[3].trueTotal, stars[4].trueTotal, stars[5].trueTotal);
                    if (vacuum) {
                        assignResetInformation.mergeReward();
                        const base = buildings[3].true / (global.mergeInfo.galaxies + 1) + 1;
                        getQuery('#mergeBaseStat > span').textContent = format(base, { padding: true });
                        const reward1 = calculateEffects.reward[0](true) / calculateEffects.reward[0]();
                        getQuery('#merge1Stat > span').textContent = format(reward1, { padding: true });
                        getId('mergeTotal').textContent = format(base * reward1, { padding: true });
                    }
                }
            }
            for (let i = 0; i < global.buildingsInfo.maxActive[active]; i++) {
                getId(`building${i}StatTotal`).textContent = format(buildings[i].total, { padding: true });
                getId(`building${i}StatTrueTotal`).textContent = format(buildings[i].trueTotal, { padding: true });
            }

            getId('strange0StatTotal').textContent = format(player.strange[0].total, { padding: true });
            getId('strange1StatTotal').textContent = format(player.strange[1].total, { padding: true });
            getId('cosmonStatTotal').textContent = format(player.cosmon.total, { padding: 'exponent' });
        }
    }
};

export const visualUpdate = () => {
    const { tab, subtab } = global;
    const { active, true: highest } = player.stage;
    const vacuum = player.inflation.vacuum;

    if (!player.event) {
        if (highest === 6) {
            if (player.merge.resets >= 1) { playEvent(8, false); }
        } else if (highest === 5) {
            if (active === 5) { playEvent(5, false); }
        } else if (highest === 4) {
            if (player.collapse.stars[1] >= 1) { playEvent(4, false); }
        } else if (highest === 3) {
            if (player.buildings[3][0].current.moreOrEqual('5e29')) { playEvent(3, false); }
        } else if (highest === 2) {
            if (new Overlimit(assignResetInformation.newClouds()).plus(player.vaporization.clouds).moreThan('1e4')) { playEvent(2, false); }
        } else if (highest === 1) {
            if (player.upgrades[1][9] === 1) { playEvent(1, false); }
        }
    }

    if (global.footer) {
        if (globalSave.toggles[1]) { getId('ElementsTabBtn').style.display = player.upgrades[4][1] === 1 ? '' : 'none'; }
        if (active === 1) {
            if (highest < 2) {
                getId('footerStat2').style.display = player.discharge.energyMax >= 12 ? '' : 'none';
                getId('upgradeTabBtn').style.display = player.discharge.energyMax >= 12 ? '' : 'none';
            }
        } else if (active === 2) {
            getId('footerStat3').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
        }
    }
    if (globalSave.MDSettings[0]) {
        let showReset1 = tab === 'stage' || tab === 'upgrade' || tab === 'Elements' || tab === 'inflation';
        getId('structuresFooter').style.display = showReset1 ? '' : 'none';
        if (active === 4) {
            getId('resetGalaxyFooter').style.display = showReset1 && player.researchesExtra[5][0] >= 1 ? '' : 'none';
        } else if (active === 5) {
            getId('resetCollapseFooter').style.display = showReset1 ? '' : 'none';
        }
        if (showReset1) {
            if (active === 1) {
                showReset1 = player.upgrades[1][5] === 1;
            } else if (active === 2) {
                showReset1 = player.upgrades[2][2] === 1;
            } else if (active === 4) {
                showReset1 = player.upgrades[4][0] === 1;
            } else if (active === 5) {
                showReset1 = player.upgrades[5][3] === 1;
            } else if (active === 6) {
                showReset1 = false;
            }
        }
        getId('reset1Footer').style.display = showReset1 ? '' : 'none';
        getId('stageFooter').style.display = (tab === 'stage' && (highest >= 2 || player.upgrades[1][9] === 1)) || tab === 'strangeness' ? '' : 'none';
    }

    if (tab === 'stage') {
        if (subtab.stageCurrent === 'Structures') {
            const buildings = player.buildings[active];
            const ASR = player.ASR[active];

            getId('stageTimeReal').style.display = player.stage.time !== player.time.stage ? '' : 'none';
            getId('exportMaxed').style.display = player.time.export[0] >= 86400 && (highest >= 7 || player.strange[0].total > 0) ? '' : 'none';
            if (highest < 7) {
                if (highest < 2) { getId('toggleBuilding0').style.display = ASR >= 1 ? '' : 'none'; }
                getId('resetStage').style.display = player.stage.resets >= 1 || (vacuum ? player.elements[26] >= 1 : player.upgrades[1][9] === 1) ? '' : 'none';
            }
            for (let i = 1; i < global.buildingsInfo.maxActive[active]; i++) {
                getId(`building${i}True`).style.display = buildings[i].current.notEqual(buildings[i as 1].true) ? '' : 'none';
                getId(`toggleBuilding${i}`).style.display = ASR >= i ? '' : 'none';
            }
            if (active === 1) {
                getId('reset1Main').style.display = player.upgrades[1][5] === 1 ? '' : 'none';
                getId('building2').style.display = buildings[1].trueTotal.moreOrEqual(vacuum ? '5' : '18') ? '' : 'none';
                getId('building3').style.display = buildings[2].trueTotal.moreOrEqual('2') ? '' : 'none';
                if (vacuum) {
                    getId('building4').style.display = buildings[3].trueTotal.moreOrEqual('18') ? '' : 'none';
                    getId('building5').style.display = buildings[4].trueTotal.moreOrEqual('2') ? '' : 'none';
                }
                getId('stageInfo').style.display = player.upgrades[1][5] === 1 ? '' : 'none';
                getId('tritiumEffect').style.display = player.upgrades[1][8] === 1 ? '' : 'none';
                if (highest < 7) { getId('resets').style.display = player.stage.resets >= 1 || player.upgrades[1][5] === 1 ? '' : 'none'; }
            } else if (active === 2) {
                getId('reset1Main').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
                getId('building2').style.display = buildings[1].trueTotal.moreOrEqual('4e2') ? '' : 'none';
                getId('building3').style.display = buildings[1].trueTotal.moreOrEqual('8e6') ? '' : 'none';
                getId('building4').style.display = buildings[1].trueTotal.moreOrEqual('8e17') ? '' : 'none';
                getId('building5').style.display = buildings[1].trueTotal.moreOrEqual('8e22') ? '' : 'none';
                getId('cloudEffect').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
                getId('vaporizationBoostTotal').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
                if (vacuum) {
                    getId('building6').style.display = buildings[1].trueTotal.moreOrEqual('2e25') ? '' : 'none';
                    if (highest < 7) { getId('resets').style.display = player.stage.resets >= 1 || player.upgrades[2][2] === 1 ? '' : 'none'; }
                } else { getId('stageInfo').style.display = player.upgrades[2][2] === 1 ? '' : 'none'; }
            } else if (active === 3) {
                const upgrades = player.upgrades[3];

                getId('buildings').style.display = player.accretion.rank >= 1 ? '' : 'none';
                getId('building2').style.display = upgrades[2] === 1 || buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('building3').style.display = upgrades[4] === 1 || buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('building4').style.display = upgrades[8] === 1 || buildings[4].trueTotal.moreThan('0') ? '' : 'none';
                getId('dustSoftcap').style.display = global.accretionInfo.dustSoft !== 1 ? '' : 'none';
                if (vacuum) {
                    getId('building5').style.display = upgrades[11] === 1 || buildings[5].trueTotal.moreThan('0') ? '' : 'none';
                    getId('submersionBoost').style.display = player.researchesExtra[1][2] >= 2 ? '' : 'none';
                } else { getId('stageInfo').style.display = global.accretionInfo.dustSoft !== 1 ? '' : 'none'; }
                updateRankInfo();
            } else if (active === 4) {
                const nova = player.researchesExtra[4][0];

                getId('reset1Main').style.display = player.upgrades[4][0] === 1 ? '' : 'none';
                getId('specials').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('special2').style.display = buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('special3').style.display = buildings[4].trueTotal.moreThan('0') ? '' : 'none';
                getId('building2').style.display = nova >= 1 ? '' : 'none';
                getId('building3').style.display = nova >= 2 ? '' : 'none';
                getId('building4').style.display = nova >= 3 ? '' : 'none';
                getId('star1Effect').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('star2Effect').style.display = buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('star3Effect').style.display = buildings[4].trueTotal.moreThan('0') ? '' : 'none';
                getId('collapseBoostTotal').style.display = player.upgrades[4][0] === 1 ? '' : 'none';
                if (vacuum) {
                    getId('building5').style.display = player.elements[26] >= 1 ? '' : 'none';
                    getId('mainCap').style.display = player.upgrades[4][0] === 1 ? '' : 'none';
                    if (highest < 7) { getId('resets').style.display = player.stage.resets >= 1 || player.upgrades[4][0] === 1 ? '' : 'none'; }
                }
            } else if (active === 5) {
                getId('reset1Main').style.display = player.upgrades[5][3] === 1 ? '' : 'none';
                if (vacuum) {
                    getId('specials').style.display = player.upgrades[5][3] === 1 ? '' : 'none';
                    getId('mergeEffects').style.display = player.upgrades[5][3] === 1 ? '' : 'none';
                    getId('mergeBoostTotal').style.display = player.upgrades[5][3] === 1 ? '' : 'none';
                } else {
                    getId('buildings').style.display = player.milestones[2][0] >= 7 || player.milestones[3][0] >= 7 ? '' : 'none';
                    getId('building1').style.display = player.milestones[2][0] >= 7 ? '' : 'none';
                    getId('building2').style.display = player.milestones[3][0] >= 7 ? '' : 'none';
                    if (highest < 7) { getId('mergeResetText').innerHTML = 'Attempt to <span class="darkvioletText">Merge</span> <span class="grayText">Galaxies</span> together to create even bigger Structures. Might have severe consequences.'; }
                }
                getId('building3').style.display = player.researchesExtra[5][0] >= 1 ? '' : 'none';
            } else if (active === 6) {
                getId('universeTimeReal').style.display = player.inflation.age !== player.time.universe ? '' : 'none';
            }
        } else if (subtab.stageCurrent === 'Advanced') {
            if (global.lastChallenge[0] === 0) {
                const progress = player.challenges.voidCheck;
                getId('voidRewards').style.display = '';
                getId('voidReward2').style.display = progress[1] >= 3 ? '' : 'none';
                getId('voidReward3').style.display = progress[1] >= 2 ? '' : 'none';
                getId('voidReward4').style.display = progress[3] >= 5 ? '' : 'none';
                getId('voidReward5').style.display = progress[4] >= 4 ? '' : 'none';
            } else { getId('voidRewards').style.display = 'none'; }
            getId('supervoidLabel').style.display = highest >= 7 && global.lastChallenge[0] === 0 ? '' : 'none';
            if (highest < 7) { getId('challenge1').style.display = player.stage.resets >= 1 ? '' : 'none'; }
        }
    } else if (tab === 'upgrade' || tab === 'Elements') {
        const trueSubtab = tab === 'Elements' ? tab : subtab.upgradeCurrent;
        if (trueSubtab === 'Upgrades') {
            if (vacuum) {
                getId('researchAuto1').style.display = player.researchesExtra[1][2] >= 2 ? '' : 'none';
                getId('researchAuto2').style.display = player.accretion.rank >= 6 ? '' : 'none';
            }
            if (active === 1) {
                const superposition = player.upgrades[1][5] === 1;

                getId('upgrade7').style.display = superposition ? '' : 'none';
                getId('upgrade8').style.display = superposition ? '' : 'none';
                getId('upgrade9').style.display = superposition ? '' : 'none';
                getId('upgrade10').style.display = superposition ? '' : 'none';
                getId('stageResearches').style.display = superposition ? '' : 'none';
                if (vacuum) {
                    getId('extraResearches').style.display = superposition ? '' : 'none';
                    getId('researchExtra2').style.display = player.researchesExtra[1][2] >= 2 ? '' : 'none';
                    getId('researchExtra4').style.display = player.researchesExtra[1][2] >= 1 ? '' : 'none';
                    getId('researchExtra5').style.display = player.accretion.rank >= 6 ? '' : 'none';
                }
                if (highest < 7) { getId('researches').style.display = superposition ? '' : 'none'; }
            } else if (active === 2) {
                const buildings = player.buildings[2];

                getId('upgrade2').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('upgrade3').style.display = buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('upgrade4').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('upgrade5').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('upgrade6').style.display = buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('upgrade7').style.display = buildings[4].trueTotal.moreThan('0') ? '' : 'none';
                getId('upgrade8').style.display = player.strangeness[2][2] >= 3 && buildings[5].trueTotal.moreThan('0') ? '' : 'none';
                if (vacuum) {
                    getId('upgrade9').style.display = player.strangeness[2][8] >= 3 && buildings[6].trueTotal.moreThan('0') ? '' : 'none';
                    getId('researchExtra4').style.display = player.accretion.rank >= 6 ? '' : 'none';
                    getId('researchExtra5').style.display = player.strangeness[5][9] >= 1 && player.accretion.rank >= 7 ? '' : 'none';
                }
                getId('research2').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('research3').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('research4').style.display = buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('research5').style.display = buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('research6').style.display = buildings[4].trueTotal.moreThan('0') ? '' : 'none';
                getId('extraResearches').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
                getId('researchExtra3').style.display = buildings[5].trueTotal.moreThan('0') ? '' : 'none';
            } else if (active === 3) {
                const rank = player.accretion.rank;
                const planetesimal = player.buildings[3][2].trueTotal.moreThan('0');

                getId('upgrade3').style.display = rank >= 2 ? '' : 'none';
                getId('upgrade4').style.display = planetesimal ? '' : 'none';
                getId('upgrade5').style.display = rank >= 3 ? '' : 'none';
                getId('upgrade6').style.display = rank >= 4 || player.upgrades[3][4] === 1 ? '' : 'none';
                getId('upgrade7').style.display = rank >= 4 ? '' : 'none';
                getId('upgrade8').style.display = rank >= 4 && player.strangeness[3][2] >= 3 ? '' : 'none';
                getId('upgrade9').style.display = rank >= 4 ? '' : 'none';
                getId('upgrade10').style.display = rank >= 4 ? '' : 'none';
                getId('upgrade11').style.display = rank >= 5 ? '' : 'none';
                getId('upgrade12').style.display = rank >= 5 ? '' : 'none';
                getId('upgrade13').style.display = rank >= 5 ? '' : 'none';
                getId('research3').style.display = planetesimal ? '' : 'none';
                getId('research4').style.display = planetesimal ? '' : 'none';
                getId('research5').style.display = rank >= 3 ? '' : 'none';
                getId('research6').style.display = rank >= 3 ? '' : 'none';
                getId('research7').style.display = rank >= 4 || player.upgrades[3][4] === 1 ? '' : 'none';
                getId('research8').style.display = rank >= 4 ? '' : 'none';
                getId('research9').style.display = rank >= 5 ? '' : 'none';
                getId('extraResearches').style.display = rank >= 2 || (vacuum && player.challenges.supervoid[3] >= 1) ? '' : 'none';
                getId('researchExtra2').style.display = rank >= 3 || (vacuum && player.challenges.supervoid[3] >= 2) ? '' : 'none';
                getId('researchExtra3').style.display = rank >= 4 ? '' : 'none';
                getId('researchExtra4').style.display = rank >= 5 ? '' : 'none';
                if (vacuum) {
                    getId('researchExtra5').style.display = rank >= 3 && player.researchesExtra[1][2] >= 2 ? '' : 'none';
                } else {
                    getId('upgrades').style.display = rank >= 1 ? '' : 'none';
                    getId('stageResearches').style.display = rank >= 1 ? '' : 'none';
                }
            } else if (active === 4) {
                const { strangeness } = player;
                const stars = player.collapse.stars;
                const galaxy = player.researchesExtra[5][0] >= 1;

                getId('upgrade4').style.display = strangeness[4][2] >= 3 ? '' : 'none';
                getId('upgrade5').style.display = strangeness[4][9] >= 1 ? '' : 'none';
                getId('research4').style.display = (galaxy || stars[0] > 0) && strangeness[4][2] >= 1 ? '' : 'none';
                getId('research5').style.display = galaxy || stars[2] > 0 ? '' : 'none';
                getId('research6').style.display = (galaxy || stars[2] > 0) && strangeness[4][9] >= 3 ? '' : 'none';
                getId('researchExtra2').style.display = galaxy || stars[0] > 0 ? '' : 'none';
                getId('researchExtra3').style.display = (galaxy || stars[0] > 0) && strangeness[4][2] >= 2 ? '' : 'none';
                getId('researchExtra4').style.display = (galaxy || stars[1] > 0) && strangeness[4][9] >= 2 ? '' : 'none';
            } else if (active === 5) {
                const galaxy = player.researchesExtra[5][0] >= 1;
                if (vacuum) {
                    const protogalaxy = player.accretion.rank >= 7;
                    getId('upgrade4').style.display = galaxy && protogalaxy ? '' : 'none';
                    getId('research3').style.display = protogalaxy ? '' : 'none';
                    getId('research4').style.display = protogalaxy ? '' : 'none';
                    getId('researchExtra2').style.display = protogalaxy ? '' : 'none';
                } else {
                    const nebula = player.milestones[2][0] >= 7;
                    const cluster = player.milestones[3][0] >= 7;

                    getId('upgrades').style.display = nebula || cluster ? '' : 'none';
                    getId('upgrade1').style.display = nebula ? '' : 'none';
                    getId('upgrade2').style.display = cluster ? '' : 'none';
                    getId('upgrade4').style.display = galaxy && player.milestones[5][1] >= 8 ? '' : 'none';
                    getId('stageResearches').style.display = nebula || cluster ? '' : 'none';
                    getId('research1').style.display = nebula ? '' : 'none';
                    getId('research2').style.display = cluster ? '' : 'none';
                    getId('extraResearches').style.display = player.milestones[4][1] >= 8 ? '' : 'none';
                }
                getId('upgrade3').style.display = galaxy ? '' : 'none';
            } else if (active === 6) {
                getId('upgrades').style.display = 'none';
                getId('stageResearches').style.display = 'none';
            }
        } else if (trueSubtab === 'Elements') {
            const upgrades = player.upgrades[4];
            const neutron = player.upgrades[4][2] === 1 && (player.collapse.stars[1] > 0 || player.researchesExtra[5][0] >= 1);

            let columns = 18 - (upgrades[3] === 1 ? 0 : 2) - (upgrades[4] === 1 ? (player.buildings[6][1].true > 1 ? 0 : 1) : 2);
            getId('elementsGrid').style.display = upgrades[2] === 1 ? '' : 'flex';
            for (let i = 6; i <= 10; i++) { getId(`element${i}`).style.display = upgrades[2] === 1 ? '' : 'none'; }
            for (let i = 11; i <= 26; i++) { getId(`element${i}`).style.display = neutron ? '' : 'none'; }
            if (!neutron) {
                columns = 8;
            } else if (player.collapse.show < 23) { //26 - showAhead
                for (let i = 26; i > Math.max(player.collapse.show + 3, 10); i--) { getId(`element${i}`).style.display = 'none'; }
                columns = Math.max(player.collapse.show - 9, 8); //min + show + showAhead - 20
            }
            getId('element27').style.display = upgrades[3] === 1 ? '' : 'none';
            getId('element28').style.display = upgrades[3] === 1 ? '' : 'none';
            for (let i = 29; i < global.elementsInfo.name.length; i++) {
                getId(`element${i}`).style.display = upgrades[4] === 1 && player.buildings[6][1].true >= i - 29 ? '' : 'none';
            }
            document.documentElement.style.setProperty('--elements-columns', `${columns}`);
        }
    } else if (tab === 'strangeness') {
        if (subtab.strangenessCurrent === 'Matter') {
            getId('strange1').style.display = player.strangeness[5][8] >= 1 ? '' : 'none';
            getId('strange1Unlocked').style.display = player.strangeness[5][8] >= 1 ? '' : 'none';
            if (vacuum) {
                const bound = player.strangeness[5][3] >= 1;
                const voidProgress = player.challenges.void;

                getId('strange8Stage1').style.display = voidProgress[1] >= 1 ? '' : 'none';
                getId('strange9Stage1').style.display = (voidProgress[1] >= 2 || global.milestonesInfoS6.active[0]) ? '' : 'none';
                getId('strange10Stage1').style.display = voidProgress[4] >= 2 ? '' : 'none';
                getId('strange8Stage2').style.display = voidProgress[1] >= 3 ? '' : 'none';
                getId('strange9Stage2').style.display = voidProgress[2] >= 1 ? '' : 'none';
                getId('strange10Stage2').style.display = voidProgress[2] >= 2 ? '' : 'none';
                getId('strange9Stage3').style.display = voidProgress[4] >= 4 ? '' : 'none';
                getId('strange10Stage3').style.display = voidProgress[5] >= 2 ? '' : 'none';
                getId('strange9Stage4').style.display = voidProgress[4] >= 3 ? '' : 'none';
                getId('strange10Stage4').style.display = voidProgress[5] >= 1 ? '' : 'none';
                getId('strange1Stage5').style.display = bound ? '' : 'none';
                getId('strange2Stage5').style.display = bound ? '' : 'none';
                getId('strange5Stage5').style.display = bound && (voidProgress[4] >= 1 || global.milestonesInfoS6.active[1]) ? '' : 'none';
                getId('strange6Stage5').style.display = bound ? '' : 'none';
                getId('strange8Stage5').style.display = bound ? '' : 'none';
                getId('strange9Stage5').style.display = voidProgress[3] >= 5 ? '' : 'none';
                getId('strange10Stage5').style.display = voidProgress[2] >= 3 ? '' : 'none';
            } else {
                const { milestones } = player;
                const strange5 = milestones[4][0] >= 8;
                const firstTwo = milestones[2][0] >= 7 || milestones[3][0] >= 7;

                getId('strange7Stage1').style.display = strange5 ? '' : 'none';
                getId('strange7Stage2').style.display = strange5 ? '' : 'none';
                getId('strange8Stage3').style.display = strange5 ? '' : 'none';
                getId('strange8Stage4').style.display = strange5 ? '' : 'none';
                getId(`strangeness${globalSave.MDSettings[0] ? 'Page' : 'Section'}5`).style.display = strange5 ? '' : 'none';
                getId('strange1Stage5').style.display = firstTwo ? '' : 'none';
                getId('strange2Stage5').style.display = firstTwo ? '' : 'none';
                getId('strange3Stage5').style.display = milestones[5][0] >= 8 ? '' : 'none';
                getId('strange4Stage5').style.display = firstTwo ? '' : 'none';
                getId('strange5Stage5').style.display = milestones[4][1] >= 8 ? '' : 'none';
                getId('strange6Stage5').style.display = firstTwo ? '' : 'none';
            }
        } else if (subtab.strangenessCurrent === 'Milestones') {
            if (!vacuum) {
                const milestonesS4 = player.milestones[4];
                getId('milestone1Stage5Div').style.display = milestonesS4[0] >= 8 ? '' : 'none';
                getId('milestone2Stage5Div').style.display = milestonesS4[1] >= 8 ? '' : 'none';
                if (global.stageInfo.activeAll.includes(4)) { getId('milestonesStage5Main').style.display = milestonesS4[0] >= 8 ? '' : 'none'; }
                if (global.stageInfo.activeAll.includes(5)) { getId('milestone2Stage5Main').style.display = milestonesS4[1] >= 8 ? '' : 'none'; }
            }
        }
    } else if (tab === 'inflation') {
        if (subtab.inflationCurrent === 'Researches') {
            const { startCost } = global.inflationTreeInfo;
            const total = player.cosmon.total;
            for (let i = 4; i < startCost.length; i++) {
                getId(`inflation${i + 1}`).style.display = total >= startCost[i] ? '' : 'none';
            }
        } else if (subtab.inflationCurrent === 'Milestones') {
            const activated = global.milestonesInfoS6.active;
            for (let i = 0; i < activated.length; i++) {
                getId(`inflationMilestone${i + 1}`).classList[activated[i] ? 'add' : 'remove']('completed');
            }
        }
    } else if (tab === 'settings') {
        if (subtab.settingsCurrent === 'Settings') {
            const { researchesAuto, strangeness } = player;

            getId('collapsePointsMax').textContent = strangeness[5][4] >= 1 ? 'There is no maximum value' : 'Maximum value is 40';
            getId('exportStrangeletsUnlocked').style.display = strangeness[5][8] >= 1 ? '' : 'none';
            getId('toggleAuto0').style.display = strangeness[5][6] >= 1 ? '' : 'none';
            getId('toggleAuto0Main').style.display = strangeness[5][6] >= 1 ? '' : 'none';
            if (!vacuum) { getId('stageAutoInterstellar').style.display = strangeness[5][6] >= 2 ? '' : 'none'; }
            getId('autoTogglesUpgrades').style.display = researchesAuto[0] >= 1 || researchesAuto[1] >= 2 ? '' : 'none';
            getId('autoToggle5').style.display = researchesAuto[0] >= 1 ? '' : 'none';
            getId('autoToggle6').style.display = researchesAuto[0] >= 2 ? '' : 'none';
            getId('autoToggle7').style.display = researchesAuto[0] >= 3 ? '' : 'none';
            getId('autoToggle8').style.display = researchesAuto[1] >= 2 ? '' : 'none';
            getId('toggleAuto1').style.display = strangeness[1][4] >= 1 || (researchesAuto[2] >= 1 && (vacuum || player.stage.current === 1)) ? '' : 'none';
            const showAuto2 = strangeness[2][4] >= 1 || (vacuum ? researchesAuto[2] >= 3 : (researchesAuto[2] >= 1 && player.stage.current === 2));
            getId('toggleAuto2').style.display = showAuto2 ? '' : 'none';
            getId('toggleAuto2Main').style.display = showAuto2 ? '' : 'none';
            getId('toggleAuto3').style.display = strangeness[3][4] >= 1 || (vacuum ? researchesAuto[2] >= 2 : (researchesAuto[2] >= 1 && player.stage.current === 3)) ? '' : 'none';
            const showAuto4 = strangeness[4][4] >= 1 || (vacuum ? researchesAuto[2] >= 4 : (researchesAuto[2] >= 1 && player.stage.current >= 4));
            getId('toggleAuto4').style.display = showAuto4 ? '' : 'none';
            getId('toggleAuto4Main').style.display = showAuto4 ? '' : 'none';
            getId('toggleAuto9').style.display = researchesAuto[2] >= 5 ? '' : 'none';
            getId(vacuum ? 'toggleAuto9Main' : 'mergeToggleReset').style.display = researchesAuto[2] >= 5 ? '' : 'none';
            if (highest < 7) {
                const hotkeyTest = getId('stageHotkey', true);
                if (highest < 2) {
                    getId('resetToggles').style.display = player.upgrades[1][5] === 1 ? '' : 'none';
                    if (hotkeyTest !== null) {
                        hotkeyTest.style.display = player.upgrades[1][9] === 1 ? '' : 'none';
                        getId('dischargeHotkey').style.display = player.upgrades[1][5] === 1 ? '' : 'none';
                    }
                }
                if (highest < 3) {
                    getId('vaporizationToggleReset').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
                    if (hotkeyTest !== null) { getId('vaporizationHotkey').style.display = player.upgrades[2][2] === 1 ? '' : 'none'; }
                }
                if (highest < 5) {
                    getId('collapseToggleReset').style.display = player.upgrades[4][0] === 1 ? '' : 'none';
                    getId('elementsAsTab').style.display = player.upgrades[4][1] === 1 ? '' : 'none';
                    if (hotkeyTest !== null) { getId('collapseHotkey').style.display = player.upgrades[4][0] === 1 ? '' : 'none'; }
                }
                if (highest < 6) {
                    getId('saveFileNameGalaxy').style.display = player.milestones[4][1] >= 8 ? '' : 'none';
                    if (hotkeyTest !== null) { getId('galaxyHotkey').style.display = player.milestones[4][1] >= 8 ? '' : 'none'; }
                }
                getId('stageToggleReset').style.display = player.stage.resets >= 1 || (vacuum ? player.elements[26] >= 1 : player.upgrades[1][9] === 1) ? '' : 'none';
                getId('vaporizationExtra').style.display = player.challenges.void[4] >= 1 ? '' : 'none';
                getId('exportReward').style.display = player.strange[0].total > 0 ? '' : 'none';
                getId('mergeToggleReset').style.display = vacuum && player.upgrades[5][3] === 1 ? '' : 'none';
                if (hotkeyTest !== null) {
                    getId('exitChallengeHotkey').style.display = highest >= 6 && player.stage.resets >= 1 ? '' : 'none';
                    getId('mergeHotkey').style.display = player.upgrades[5][3] === 1 ? '' : 'none';
                }
            }
        } else if (subtab.settingsCurrent === 'History') {
            updateStageHistory();
            updateVacuumHistory();
        } else if (subtab.settingsCurrent === 'Stats') {
            const { strangeness } = player;
            const buildings = player.buildings[active];

            getId('firstPlay').textContent = new Date(player.time.started).toLocaleString();
            getId('exportStatsStrangeletsUnlocked').style.display = strangeness[5][8] >= 1 ? '' : 'none';
            if (highest < 7) {
                getId('stageResets').style.display = player.stage.resets >= 1 ? '' : 'none';
                getId('exportStats').style.display = player.strange[0].total > 0 ? '' : 'none';
            }
            for (let i = 1; i < global.buildingsInfo.maxActive[active]; i++) {
                getId(`building${i}Stats`).style.display = buildings[i].trueTotal.moreThan('0') ? '' : 'none';
            }
            getId('strangeAllStats').style.display = player.strange[0].total > 0 ? '' : 'none';
            getId('strange1Stats').style.display = player.strange[1].total > 0 ? '' : 'none';

            getId('maxSolarMassStat').style.display = active === 4 || active === 5 ? '' : 'none';
            if (active === 1) {
                getId('dischargeStat').style.display = player.upgrades[1][5] === 1 ? '' : 'none';
                getId('dischargeStatTrue').style.display = player.discharge.current !== global.dischargeInfo.total ? '' : 'none';
                getId('dischargeScaleStat').style.display = player.upgrades[1][5] === 1 ? '' : 'none';
                for (let s = 1; s <= (vacuum ? 5 : 1); s++) {
                    let anyUnlocked = false;
                    for (let i = 1; i < global.buildingsInfo.maxActive[s]; i++) {
                        const unlocked = player.buildings[s][i].trueTotal.moreThan('0');
                        if (!anyUnlocked) { anyUnlocked = unlocked; }
                        getId(`energyGainStage${s}Build${i + (vacuum ? 0 : 2)}Name`).style.display = unlocked ? '' : 'none';
                        getId(`energyGainStage${s}Build${i + (vacuum ? 0 : 2)}`).style.display = unlocked ? '' : 'none';
                    }
                    getId(s === 1 ? 'energyGainStats' : `energyGainStage${s}`).style.display = anyUnlocked ? '' : 'none';
                }
                getId('effectiveEnergyStat').style.display = calculateEffects.effectiveEnergy() !== player.discharge.energy ? '' : 'none';
                if (highest < 2) {
                    getId('maxEnergyStat').style.display = player.discharge.energyMax >= 12 ? '' : 'none';
                    getId('energyGainStats').style.display = 'none';
                }
            } else if (active === 2) {
                getId('vaporizationBoost').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
                getId('rainStat').style.display = player.researchesExtra[2][1] >= 1 ? '' : 'none';
                getId('stormStat').style.display = player.researchesExtra[2][2] >= 1 ? '' : 'none';
                getId('maxCloudStat').style.display = player.upgrades[2][2] === 1 ? '' : 'none';
            } else if (active === 3) {
                getId('currentRankTrue').style.display = global.accretionInfo.effective !== player.accretion.rank ? '' : 'none';
                if (vacuum) {
                    getId('rankStat0').style.display = strangeness[2][9] >= 1 ? '' : 'none';
                }
                for (let i = 1; i < global.accretionInfo.rankImage.length; i++) { getId(`rankStat${i}`).style.display = player.accretion.rank >= i ? '' : 'none'; }
            } else if (active === 4) {
                const auto2 = strangeness[4][4] >= 2;
                getId('star1Stat').style.display = !auto2 && buildings[2].trueTotal.moreThan('0') ? '' : 'none';
                getId('star2Stat').style.display = !auto2 && buildings[3].trueTotal.moreThan('0') ? '' : 'none';
                getId('star3Stat').style.display = !auto2 && buildings[4].trueTotal.moreThan('0') ? '' : 'none';
                getId('gammaRayStat').style.display = player.elements[26] >= 1 || player.researches[4][4] >= 1 ? '' : 'none';
                getId('quasarStat').style.display = player.researchesExtra[5][0] >= 1 ? '' : 'none';
            } else if (active === 5) {
                if (vacuum) {
                    getId('mergeBoost').style.display = player.upgrades[5][3] === 1 ? '' : 'none';
                }
            }
        }
    }
};
export const visualTrueStageUnlocks = () => {
    const highest = player.stage.true;
    const hotkeyTest = getId('stageHotkey', true);

    getId('stageRewardOld').style.display = highest < 5 ? '' : 'none';
    getId('stageRewardNew').style.display = highest >= 5 ? '' : 'none';
    getId('autoWaitMain').style.display = highest >= 3 ? '' : 'none';
    getId('researchAuto3').style.display = highest >= 7 ? '' : 'none';
    getId(globalSave.MDSettings[0] ? 'toggleHover0' : 'researchToggles').style.display = highest >= 2 ? '' : 'none';
    getId('toggleMax0').style.display = highest >= 4 ? '' : 'none';
    getId('globalSpeed').style.display = highest >= 7 ? '' : 'none';
    getId('strange1GlobalSpeedInfo').style.display = highest >= 7 ? '' : 'none';
    getQuery('#resetToggles > h2 > span').style.display = highest >= 5 ? '' : 'none';
    getId('themeArea').style.display = highest >= 2 || globalSave.theme !== null ? '' : 'none';
    getId('switchTheme2').style.display = highest >= 2 ? '' : 'none';
    getId('switchTheme3').style.display = highest >= 3 ? '' : 'none';
    getId('switchTheme4').style.display = highest >= 4 ? '' : 'none';
    getId('switchTheme5').style.display = highest >= 5 ? '' : 'none';
    getId('switchTheme6').style.display = highest >= 7 ? '' : 'none';
    getId('saveFileNameStrange').style.display = highest >= 5 ? '' : 'none';
    getId('saveFileNameVacuum').style.display = highest >= 6 ? '' : 'none';
    getId('saveFileNameUniverse').style.display = highest >= 7 ? '' : 'none';
    getId('saveFileNameCosmon').style.display = highest >= 7 ? '' : 'none';
    getId('autoStageSwitch').style.display = highest >= 5 ? '' : 'none';
    getId('cosmonStat').style.display = highest >= 7 ? '' : 'none';
    getId('vacuumHistory').style.display = highest >= 7 ? '' : 'none';
    if (hotkeyTest !== null) {
        getId('stageRightHotkey').style.display = highest >= 5 ? '' : 'none';
        getId('stageLeftHotkey').style.display = highest >= 5 ? '' : 'none';
    }
    if (highest >= 2) {
        getId('toggleBuilding0').style.display = '';
        getId('resetToggles').style.display = '';
        getId('maxEnergyStat').style.display = '';
        getId('upgradeTabBtn').style.display = '';
        if (hotkeyTest !== null) { hotkeyTest.style.display = ''; }
    }
    if (highest >= 5) {
        getId('elementsAsTab').style.display = '';
    }
    if (highest >= 6) {
        getId('dischargeToggleReset').style.display = '';
        getId('saveFileNameGalaxy').style.display = '';
        for (let s = 2; s <= 5; s++) {
            getId(`strangeness${globalSave.MDSettings[0] ? 'Page' : 'Section'}${s}`).style.display = '';
            getId(`milestone1Stage${s}Div`).style.display = '';
            getId(`milestone2Stage${s}Div`).style.display = '';
        }
    }
    if (highest >= 7) {
        getId('stageSelect').style.display = '';
        getId('resets').style.display = '';
        getId('resetStage').style.display = '';
        getId('challenge1').style.display = '';
        getId('researches').style.display = '';
        getId('vaporizationExtra').style.display = '';
        getId('stageToggleReset').style.display = '';
        getId('vaporizationToggleReset').style.display = '';
        getId('rankToggleReset').style.display = '';
        getId('collapseToggleReset').style.display = '';
        getId('strangenessTabBtn').style.display = '';
        getId('stageResets').style.display = '';
        getId('exportReward').style.display = '';
        getId('exportStats').style.display = '';
        if (hotkeyTest !== null) { getId('exitChallengeHotkey').style.display = ''; }
    }
};

export const getUpgradeDescription = (index: number | null, type: 'upgrades' | 'researches' | 'researchesExtra' | 'researchesAuto' | 'ASR' | 'elements' | 'inflation') => {
    if (type === 'inflation') {
        if (index === null) {
            getId('inflationText').textContent = 'Hover to see.';
            getId('inflationEffect').textContent = 'Hover to see.';
            getId('inflationCost').textContent = 'Cosmon.';
            return;
        }
        const pointer = global.inflationTreeInfo;
        const level = player.inflation.tree[index];

        getId('inflationText').textContent = `${pointer.name[index]}. (Level ${level} out of ${pointer.max[index]})`;
        getId('inflationEffect').textContent = pointer.effectText[index]();
        getId('inflationCost').textContent = level >= pointer.max[index] ? 'Fully activated.' : `${format(pointer.cost[index])} Cosmon.`;
        return;
    }
    if (type === 'elements') {
        if (index === null) {
            getId('elementText').textContent = 'Hover to see.';
            getId('elementEffect').textContent = 'Hover to see.';
            getId('elementCost').textContent = 'Elements.';
            return;
        }
        const pointer = global.elementsInfo;

        getId('elementText').textContent = `${pointer.name[index]}.`;
        getId('elementEffect').textContent = player.elements[index] >= 1 || (player.collapse.show >= index && index !== 0) ? pointer.effectText[index]() : 'Effect is not yet known.';
        getId('elementCost').textContent = player.elements[index] >= 1 ? 'Obtained.' :
            player.elements[index] > 0 ? 'Awaiting Collapse.' :
            index === 0 ? 'Unknown.' : `${format(pointer.startCost[index])} Elements.${globalSave.MDSettings[0] ? ' (Hold to create)' : ''}`;
        return;
    }

    const stageIndex = player.stage.active;
    if (index === null) {
        getId('upgradeText').textContent = 'Hover to see.';
        getId('upgradeEffect').textContent = 'Hover to see.';
        getId('upgradeCost').textContent = `${global.stageInfo.costName[stageIndex]}.`;
        return;
    }
    if (type === 'upgrades') {
        const pointer = global[`${type}Info`][stageIndex];

        getId('upgradeText').textContent = `${pointer.name[index]}.`;
        getId('upgradeEffect').textContent = pointer.effectText[index]();
        getId('upgradeCost').textContent = player.upgrades[stageIndex][index] === 1 ? 'Created.' :
            stageIndex === 4 && global.collapseInfo.unlockU[index] > player.collapse.mass && player.researchesExtra[5][0] < 1 ? `Unlocked at ${format(global.collapseInfo.unlockU[index])} Mass.` :
            `${format(pointer.startCost[index])} ${global.stageInfo.costName[stageIndex]}.`;
    } else if (type === 'researches' || type === 'researchesExtra') {
        const pointer = global[`${type}Info`][stageIndex];
        const level = player[type][stageIndex][index];
        if (type === 'researchesExtra' && stageIndex === 4 && index === 0) { pointer.name[0] = ['Nova', 'Supernova', 'Hypernova'][Math.min(level, 2)]; }

        getId('upgradeText').textContent = `${pointer.name[index]}. (Level ${level} out of ${pointer.max[index]})`;
        getId('upgradeEffect').textContent = pointer.effectText[index]();
        if (level >= pointer.max[index]) {
            getId('upgradeCost').textContent = 'Maxed.';
        } else if (stageIndex === 4 && type === 'researches' && global.collapseInfo.unlockR[index] > player.collapse.mass && player.researchesExtra[5][0] < 1) {
            getId('upgradeCost').textContent = `Unlocked at ${format(global.collapseInfo.unlockR[index])} Mass.`;
        } else if (stageIndex === 5 && global.mergeInfo[`unlock${type === 'researches' ? 'R' : 'E'}`][index] > player.buildings[6][1].true) {
            getId('upgradeCost').textContent = `Requires at least ${global.mergeInfo[`unlock${type === 'researches' ? 'R' : 'E'}`][index]} self-made ${player.stage.true >= 7 || player.event ? 'Universes' : '(Unknown)'}.`;
        } else {
            let newLevels = 1;
            let cost = pointer.cost[index];
            if (player.toggles.max[0] && pointer.max[index] > 1) {
                const scaling = pointer.scaling[index];
                if (stageIndex === 1) {
                    if (player.accretion.rank >= 6 && player.strangeness[1][9] >= 1) {
                        newLevels = Math.min(Math.max(Math.floor((player.discharge.energy - cost) / scaling + 1), 1), pointer.max[index] - level);
                        if (newLevels > 1) { cost += (newLevels - 1) * scaling; }
                    } else {
                        const simplify = cost - scaling / 2;
                        newLevels = Math.min(Math.max(Math.floor(((simplify ** 2 + 2 * scaling * player.discharge.energy) ** 0.5 - simplify) / scaling), 1), pointer.max[index] - level);
                        if (newLevels > 1) { cost = newLevels * (newLevels * scaling / 2 + simplify); }
                    }
                } else {
                    const currency = stageIndex === 2 ? player.buildings[2][1].current : stageIndex === 3 ? player.buildings[3][0].current : player.buildings[4][0].current;
                    newLevels = Math.min(Math.max(Math.floor(new Overlimit(currency).multiply(scaling - 1).divide(cost).plus('1').log(scaling).toNumber()), 1), pointer.max[index] - level);
                    if (newLevels > 1) { cost = new Overlimit(scaling).power(newLevels).minus('1').divide(scaling - 1).multiply(cost).toNumber(); }
                }
            }

            getId('upgradeCost').textContent = `${format(cost)} ${global.stageInfo.costName[stageIndex]}.${newLevels > 1 ? ` [x${newLevels}]` : ''}`;
        }
    } else if (type === 'researchesAuto') {
        const pointer = global.researchesAutoInfo;
        let level = player.researchesAuto[index];

        getId('upgradeText').textContent = `${pointer.name[index]}. (Level ${level} out of ${pointer.max[index]})`;
        getId('upgradeEffect').textContent = pointer.effectText[index]();
        if (level >= pointer.max[index]) {
            getId('upgradeCost').textContent = 'Maxed.';
        } else {
            const autoStage = pointer.autoStage[index][level];
            if (index === 1) { //Level from here can only be used for cost
                if (player.strangeness[4][6] >= 1) { level--; }
            } else if (index === 2) {
                if (player.strangeness[1][4] >= 1) { level--; }
                if (player.strangeness[2][4] >= 1) { level--; }
                if (player.strangeness[3][4] >= 1) { level--; }
                if (player.strangeness[4][4] >= 1) { level--; }
            }
            if (index === 1 && player.strangeness[4][6] >= 1) { level = Math.max(level - 1, 0); }
            getId('upgradeCost').textContent = !(autoStage === stageIndex || (stageIndex === 5 && autoStage === 4)) ? `This level can only be created while inside '${global.stageInfo.word[autoStage]}'.` :
                `${format(pointer.costRange[index][Math.max(level, 0)])} ${global.stageInfo.costName[stageIndex]}.`;
        }
    } else if (type === 'ASR') {
        const pointer = global.ASRInfo;
        const level = player.ASR[stageIndex];

        getId('upgradeText').textContent = `${pointer.name}. (Level ${level} out of ${pointer.max[stageIndex]})`;
        getId('upgradeEffect').textContent = pointer.effectText();
        getId('upgradeCost').textContent = level >= pointer.max[stageIndex] ? 'Maxed.' :
            stageIndex === 1 && player.upgrades[1][5] !== 1 ? "Cannot be created without 'Superposition' Upgrade" :
            stageIndex === 3 && player.accretion.rank < 1 ? "Cannot be created at 'Ocean world' Rank." :
            `${format(pointer.costRange[stageIndex][level])} ${global.stageInfo.costName[stageIndex]}.`;
    }
};

export const getStrangenessDescription = (index: number | null, stageIndex: number, type: 'strangeness' | 'milestones') => {
    const stageText = getId(`${type}Stage`);
    if (index !== null) {
        stageText.style.color = `var(--${global.stageInfo.textColor[stageIndex]}-text)`;
        stageText.textContent = `${global.stageInfo.word[stageIndex]}. `;
    } else { stageText.textContent = ''; }
    if (type === 'strangeness') {
        if (index === null) {
            getId('strangenessText').textContent = 'Hover to see.';
            getId('strangenessEffect').textContent = 'Hover to see.';
            getId('strangenessCost').textContent = 'Strange quarks.';
            return;
        }
        const pointer = global.strangenessInfo[stageIndex];
        const level = player.strangeness[stageIndex][index];

        getId('strangenessText').textContent = `${pointer.name[index]}. (Level ${level} out of ${pointer.max[index]})`;
        getId('strangenessEffect').textContent = pointer.effectText[index]();
        getId('strangenessCost').textContent = level >= pointer.max[index] ? 'Maxed.' : `${format(pointer.cost[index])} Strange quarks.`;
    } else {
        let text;
        if (index === null) {
            getId('milestonesText').textContent = 'Hover to see.';
            text = `<p class="orchidText">Requirement: <span class="greenText">Hover to see.</span></p>
            <p class="blueText">Time limit: <span class="greenText">Hover to see.</span></p>
            <p class="darkvioletText">${player.inflation.vacuum ? 'Effect' : 'Unlock'}: <span class="greenText">Hover to see.</span></p>`;
        } else {
            const pointer = global.milestonesInfo[stageIndex];
            const level = player.milestones[stageIndex][index];
            getId('milestonesText').textContent = `${pointer.name[index]}. (Tier ${level}${player.inflation.vacuum ? '' : ` out of ${pointer.max[index]}`})`;
            if (player.inflation.vacuum) {
                const isActive = player.challenges.active === 0 && player.inflation.tree[4] >= 1;
                text = `<p class="orchidText">Requirement: <span class="greenText">${pointer.needText[index]()}</span></p>
                <p class="blueText">Time limit: <span class="greenText">${format(pointer.time[index] - (isActive ? player.time[player.challenges.super ? 'vacuum' : 'stage'] : 0), { type: 'time' })} ${isActive ? 'remains ' : ''}to increase this tier within ${player.challenges.super ? 'Super ' : ''}Void.</span></p>
                <p class="darkvioletText">Effect: <span class="greenText">${pointer.rewardText[index]()}</span>${player.inflation.tree[4] < 1 ? ' <span class="redText">(Disabled)</span>' : ''}</p>`;
            } else if (level < pointer.max[index]) {
                const isActive = global.stageInfo.activeAll.includes(Math.min(stageIndex, 4));
                text = `<p class="orchidText">Requirement: <span class="greenText">${pointer.needText[index]()}</span></p>
                <p class="blueText">Time limit: <span class="greenText">${format(pointer.time[index] - (isActive && player.inflation.tree[4] < 1 ? player.time.stage : 0), { type: 'time' })} ${isActive && player.inflation.tree[4] < 1 ? 'remains ' : ''}to complete this tier within ${isActive ? 'current' : global.stageInfo.word[index === 0 && stageIndex === 5 ? 4 : stageIndex]} Stage.</span></p>
                <p class="darkvioletText">Unlock: <span class="greenText">Main reward unlocked after ${pointer.max[index] - level} more completions.</span></p>`;
            } else { text = `<p class="darkvioletText">Reward: <span class="greenText">${pointer.rewardText[index]()}</span></p>`; }
        }

        const multilineID = getId('milestonesMultiline');
        if (multilineID.innerHTML !== text) { multilineID.innerHTML = text; }
        const container = multilineID.parentElement as HTMLElement;
        container.style.minHeight = `${container.offsetHeight}px`;
    }
};

export const getChallengeDescription = (index: number | null) => {
    let text;
    if (index === null) {
        const gain = player.inflation.vacuum ? player.buildings[6][1].true + 1 : 1;
        text = `<h3 class="darkorchidText bigWord">Vacuum information</h3>
        <p class="orchidText">Vacuum state: <span class="${player.inflation.vacuum ? 'greenText">true' : 'redText">false'}</span> | Resets: <span class="darkorchidText">${player.inflation.resets}</span></p>
        ${player.stage.true >= 7 ? `<p class="darkvioletText">Current Cosmon gain: <span class="${player.inflation.vacuum ? 'green' : 'red'}Text">${format(gain, { padding: 'exponent' })}</span> | Rate: <span class="${player.inflation.vacuum ? 'green' : 'red'}Text">${format(gain / player.time.vacuum, { type: 'income' })}</span></p>` : ''}
        <p class="orchidText">Time since last reset: <span class="darkorchidText">${format(player.inflation.time, { type: 'time' })}</span>${player.inflation.time !== player.time.vacuum ? ` (Real: <span class="darkorchidText">${format(player.time.vacuum, { type: 'time' })}</span>)` : ''}</p>`;
    } else {
        const isActive = player.challenges.active === index;
        const info = global.challengesInfo;
        const color = `${info.color[index]}Text`;
        text = `<h3 class="${color} bigWord">${info.name[index]}${isActive ? ', <span class="greenText">active</span>' : ''}</h3>
        <p class="whiteText">${info.description[index]()}</p>
        <div><h4 class="${color} bigWord">Effect:</h4>
        <p>${info.effectText[index]()}</p>
        <p class="blueText">${isActive ? 'Remaining time' : 'Time limit'} is <span class="cyanText">${format(info.time[index] - (isActive ? player.time[info.resetType[index]] : 0), { type: 'time' })}</span></p></div>`;
    }
    const multilineID = getId('challengeMultiline');
    if (multilineID.innerHTML !== text) { multilineID.innerHTML = text; }
};

/** Void only at the moment */
export const getChallengeReward = (index: number | null) => {
    if (index === null) { return; }
    const need = global.challengesInfo.needText[0][index];
    const reward = global.challengesInfo.rewardText[0][index];
    const current = player.challenges[player.challenges.super ? 'supervoid' : 'void'][index];
    const best = player.challenges.super ? current : player.challenges.voidCheck[index];
    const noTime = player.time[player.challenges.super ? 'vacuum' : 'stage'] > global.challengesInfo.time[0];
    let text = '';
    for (let i = 0; i < need.length; i++) {
        const unlocked = current > i;
        text += `<div><p><span class="${unlocked ? 'greenText' : 'redText'}">→</span> ${need[i]()}${!unlocked && player.challenges.active === 0 && (noTime || (index === 2 && i === 2 && player.accretion.rank > 1)) ? ' <span class="redText">(Failed)</span>' : ''}</p>
        <p><span class="${unlocked ? 'greenText' : 'redText'}">Reward:</span> ${best > i ? `${reward[i]}${!unlocked && globalSave.SRSettings[0] ? ' (not unlocked)' : ''}` : 'Not yet unlocked'}</p></div>`;
    }

    const textHTML = getId('voidRewardsDivText');
    if (textHTML.innerHTML !== text) { textHTML.innerHTML = text; }
};

export const visualUpdateUpgrades = (index: number, stageIndex: number, type: 'upgrades' | 'elements') => {
    if (type === 'upgrades') {
        if (stageIndex !== player.stage.active) { return; }

        let color = '';
        const image = getId(`upgrade${index + 1}`);
        if (player.upgrades[stageIndex][index] === 1) {
            if (stageIndex === 1) {
                color = 'green';
            } else if (stageIndex === 2) {
                color = 'darkgreen';
            } else if (stageIndex === 3) {
                color = '#0000b1'; //Darker blue
            } else if (stageIndex === 4) {
                color = '#1f1f8f'; //Brigher midnightblue
            } else if (stageIndex === 5) {
                color = '#990000'; //Brigher maroon
            } else if (stageIndex === 6) {
                color = 'white'; //Placeholder
            }
            image.tabIndex = globalSave.SRSettings[0] && globalSave.SRSettings[1] ? 0 : -1;
        } else { image.tabIndex = 0; }
        image.style.backgroundColor = color;
    } else if (type === 'elements') {
        const image = getId(`element${index}`);
        if (player.elements[index] >= 1) {
            image.classList.remove('awaiting');
            image.classList.add('created');
            image.tabIndex = globalSave.SRSettings[0] && globalSave.SRSettings[1] ? 0 : -1;
        } else if (player.elements[index] > 0) {
            image.classList.add('awaiting');
            image.classList.remove('created');
            image.tabIndex = 0;
        } else {
            image.classList.remove('awaiting');
            image.classList.remove('created');
            image.tabIndex = 0;
        }
    }
};

export const visualUpdateResearches = (index: number, stageIndex: number, type: 'researches' | 'researchesExtra' | 'researchesAuto' | 'ASR' | 'strangeness' | 'inflations') => {
    let max: number;
    let level: number;
    let upgradeHTML: HTMLElement;
    let image: HTMLElement;
    if (type === 'researches' || type === 'researchesExtra') {
        if (stageIndex !== player.stage.active) { return; }
        max = global[`${type}Info`][stageIndex].max[index];
        level = player[type][stageIndex][index];

        const extra = type === 'researches' ? '' : 'Extra';
        upgradeHTML = getId(`research${extra}${index + 1}Level`);
        getId(`research${extra}${index + 1}Max`).textContent = `${max}`;
        image = getId(`research${extra}${index + 1}Image`);
    } else if (type === 'researchesAuto') {
        max = global.researchesAutoInfo.max[index];
        level = player.researchesAuto[index];

        upgradeHTML = getId(`researchAuto${index + 1}Level`);
        getId(`researchAuto${index + 1}Max`).textContent = `${max}`;
        image = getId(`researchAuto${index + 1}Image`);
    } else if (type === 'ASR') {
        if (stageIndex !== player.stage.active) { return; }
        max = global.ASRInfo.max[stageIndex];
        level = player.ASR[stageIndex];

        upgradeHTML = getId('ASRLevel');
        getId('ASRMax').textContent = `${max}`;
        image = getId('ASRImage');
    } else if (type === 'strangeness') {
        max = global.strangenessInfo[stageIndex].max[index];
        level = player.strangeness[stageIndex][index];

        upgradeHTML = getId(`strange${index + 1}Stage${stageIndex}Level`);
        getId(`strange${index + 1}Stage${stageIndex}Max`).textContent = `${max}`;
        image = getId(`strange${index + 1}Stage${stageIndex}Image`);
    } else /*if (type === 'inflations')*/ {
        max = global.inflationTreeInfo.max[index];
        level = player.inflation.tree[index];

        upgradeHTML = getId(`inflation${index + 1}Level`);
        getId(`inflation${index + 1}Max`).textContent = `${max}`;
        image = getId(`inflation${index + 1}Image`);
    }

    upgradeHTML.textContent = `${level}`;
    if (level >= max) {
        upgradeHTML.style.color = 'var(--green-text)';
        image.tabIndex = globalSave.SRSettings[0] && globalSave.SRSettings[1] ? 0 : -1;
    } else if (level === 0) {
        upgradeHTML.style.color = ''; //Red
        image.tabIndex = 0;
    } else {
        upgradeHTML.style.color = 'var(--orchid-text)';
        image.tabIndex = 0;
    }
};

const updateRankInfo = () => {
    const rank = player.accretion.rank;
    if (global.debug.rankUpdated === rank) { return; }
    const rankInfo = global.accretionInfo;
    const name = getId('rankName');

    getId('reset1Button').textContent = rank >= rankInfo.maxRank ? 'Max Rank achieved' : `Next Rank is ${format(rankInfo.rankCost[rank])} Mass`;
    (getId('rankImage') as HTMLImageElement).src = `Used_art/${rankInfo.rankImage[rank]}`;
    name.textContent = rankInfo.rankName[rank];
    name.style.color = `var(--${rankInfo.rankColor[rank]}-text)`;
    global.debug.rankUpdated = rank;
};

export const setRemnants = () => {
    if (player.stage.active === 4) {
        const whiteDwarf = player.researchesExtra[4][2] >= 1;
        getId('special1').title = whiteDwarf ? 'White dwarfs (Red giants)' : 'Red giants';
        (getQuery('#special1 > img') as HTMLImageElement).src = `Used_art/${whiteDwarf ? 'White%20dwarf' : 'Red%20giant'}.png`;
        getId('special1Cur').className = whiteDwarf ? 'cyanText' : 'redText';

        const quarkStar = player.researchesExtra[4][3] >= 1;
        getId('special2').title = quarkStar ? 'Quark stars (Neutron stars)' : 'Neutron stars';
        (getQuery('#special2 > img') as HTMLImageElement).src = `Used_art/${quarkStar ? 'Quark%20star' : 'Neutron%20star'}.png`;
        const text2 = `Boost${quarkStar ? ' and cost decrease' : ''} to all Stars`;
        getQuery('#star2Effect > span:last-of-type').textContent = globalSave.SRSettings[0] ? ` (${text2})` : text2;
        if (globalSave.SRSettings[0]) { getId('specials').ariaLabel = 'Stars remnants'; }
    } else if (player.stage.active === 5) {
        getId('special1').title = 'Galaxy groups';
        (getQuery('#special1 > img') as HTMLImageElement).src = 'Used_art/Galaxy%20group.png';
        getId('special1Cur').className = 'grayText';
        if (globalSave.SRSettings[0]) { getId('specials').ariaLabel = 'Merge results'; }
    }
};

const updateStageHistory = () => {
    if (global.debug.historyStage === player.stage.resets) { return; }
    const list = global.historyStorage.stage;
    const length = Math.min(list.length, player.history.stage.input[1]);

    let text = '';
    if (length > 0) {
        for (let i = 0; i < length; i++) {
            text += `<li class="whiteText"><span class="greenText">${format(list[i][1], { padding: true })} Strange quarks</span>${list[i][2] > 0 ? `, <span class="greenText">${format(list[i][2], { padding: true })} Strangelets</span>` : ''}, <span class="blueText">${format(list[i][0], { type: 'time' })}</span>, <span class="darkorchidText">${format(list[i][1] / list[i][0], { type: 'income' })}</span></li>`;
        }
    } else { text = '<li class="redText">Reference list is empty</li>'; }
    getId('stageHistoryList').innerHTML = text;

    const best = player.history.stage.best;
    getId('stageHistoryBest').innerHTML = `<span class="greenText">${format(best[1], { padding: true })} Strange quarks</span>${best[2] > 0 ? `, <span class="greenText">${format(best[2], { padding: true })} Strangelets</span>` : ''}, <span class="blueText">${format(best[0], { type: 'time' })}</span>, <span class="darkorchidText">${format(best[1] / best[0], { type: 'income' })}</span>`;
    global.debug.historyStage = player.stage.resets;
};
const updateVacuumHistory = () => {
    if (global.debug.historyVacuum === player.inflation.resets) { return; }
    const list = global.historyStorage.vacuum;
    const length = Math.min(list.length, player.history.vacuum.input[1]);

    let text = '';
    if (length > 0) {
        for (let i = 0; i < length; i++) {
            text += `<li class="whiteText"><span class="darkvioletText">${format(list[i][2], { padding: true })} Cosmon</span>, <span class="blueText">${format(list[i][0], { type: 'time' })}</span>, <span class="darkorchidText">${format(list[i][2] / list[i][0], { type: 'income' })}</span>, <span class="${list[i][1] ? 'greenText">true' : 'redText">false'} Vacuum</span></li>`;
        }
    } else { text = '<li class="redText">Reference list is empty</li>'; }
    getId('vacuumHistoryList').innerHTML = text;

    const best = player.history.vacuum.best;
    getId('vacuumHistoryBest').innerHTML = `<span class="darkvioletText">${format(best[2], { padding: true })} Cosmon</span>, <span class="blueText">${format(best[0], { type: 'time' })}</span>, <span class="darkorchidText">${format(best[2] / best[0], { type: 'income' })}</span>, <span class="${best[1] ? 'greenText">true' : 'redText">false'} Vacuum</span>`;
    global.debug.historyVacuum = player.inflation.resets;
};

/** @param padding 'exponent' value will behave as true, but only after number turns into its shorter version */
export const format = (input: number | Overlimit, settings = {} as { type?: 'number' | 'input' | 'time' | 'income', padding?: boolean | 'exponent' }): string => {
    if (typeof input === 'object') { return input?.format(settings as any); }
    const type = settings.type ?? 'number';
    let padding = settings.padding;

    let extra;
    if (type === 'income') {
        const inputAbs = Math.abs(input);
        if (inputAbs >= 1) {
            extra = 'per second';
        } else if (inputAbs >= 1 / 60) {
            input *= 60;
            extra = 'per minute';
        } else if (inputAbs >= 1 / 3600) {
            input *= 3600;
            extra = 'per hour';
        } else if (inputAbs >= 1 / 86400) {
            input *= 86400;
            extra = 'per day';
        } else if (inputAbs >= 1 / 31556952) {
            input *= 31556952;
            extra = 'per year';
        } else if (inputAbs >= 1 / 3.1556952e10) {
            input *= 3.1556952e10;
            extra = 'per millennium';
        } else if (inputAbs >= 1 / 3.1556952e13) {
            input *= 3.1556952e13;
            extra = 'per megaannum';
        } else {
            input *= 3.1556952e16;
            extra = 'per eon';
        }

        if (padding === undefined) { padding = true; }
    } else if (type === 'time') {
        const inputAbs = Math.abs(input);
        if (inputAbs < 60) {
            extra = 'seconds';
        } else if (inputAbs < 3600) {
            const minutes = Math.trunc(input / 60);
            const seconds = Math.trunc(input - minutes * 60);
            if (padding === false && seconds === 0) { return `${minutes} minutes`; }
            return `${minutes} minutes ${seconds} seconds`;
        } else if (inputAbs < 86400) {
            const hours = Math.trunc(input / 3600);
            const minutes = Math.trunc(input / 60 - hours * 60);
            if (padding === false && minutes === 0) { return `${hours} hours`; }
            return `${hours} hours ${minutes} minutes`;
        } else if (inputAbs < 31556952) {
            const days = Math.trunc(input / 86400);
            const hours = Math.trunc(input / 3600 - days * 24);
            if (padding === false && hours === 0) { return `${days} days`; }
            return `${days} days ${hours} hours`;
        } else if (inputAbs < 3.1556952e10) {
            const years = Math.trunc(input / 31556952);
            const days = Math.trunc(input / 86400 - years * 365.2425);
            if (padding === false && days === 0) { return `${years} years`; }
            return `${years} years ${days} days`;
        } else if (inputAbs < 3.1556952e13) {
            input /= 3.1556952e10;
            extra = 'millenniums';
        } else if (inputAbs < 3.1556952e16) {
            input /= 3.1556952e13;
            extra = 'megaannums';
        } else {
            input /= 3.1556952e16;
            extra = 'eons';
        }

        padding = !(padding === false && Math.trunc(input) === input);
    }
    if (!isFinite(input)) { return extra !== undefined ? `${input} ${extra}` : `${input}`; }

    const inputAbs = Math.abs(input);
    if (inputAbs >= 1e6 || (inputAbs < 1e-3 && inputAbs > 0)) {
        let digits = Math.floor(Math.log10(inputAbs));
        let result = Math.round(input / 10 ** (digits - 2)) / 100;
        if (Math.abs(result) === 10) {
            result /= 10;
            digits++;
        }

        if (padding === 'exponent') { padding = true; }
        let formated = padding ? result.toFixed(2) : `${result}`;
        if (type === 'input') { return `${formated}e${digits}`; }
        formated = `${formated.replace('.', globalSave.format[0])}e${digits}`;
        return extra !== undefined ? `${formated} ${extra}` : formated;
    }

    const precision = Math.max(4 - Math.floor(Math.log10(Math.max(inputAbs, 1))), 0);
    const result = Math.round(input * 10 ** precision) / 10 ** precision;

    if (padding === 'exponent') { padding = false; }
    let formated = padding ? result.toFixed(precision) : `${result}`;
    if (type === 'input') { return formated; }
    formated = formated.replace('.', globalSave.format[0]);
    if (result >= 1e3) { formated = formated.replace(/\B(?=(\d{3})+(?!\d))/, globalSave.format[1]); }
    return extra !== undefined ? `${formated} ${extra}` : formated;
};

/** @param offline used to return early if game is paused due to calculating offline, requires another call after calculations are done */
export const stageUpdate = (changed = true, offline = false) => {
    const { stageInfo, buildingsInfo } = global;
    const { active, current, true: highest } = player.stage;
    const activeAll = stageInfo.activeAll;
    const vacuum = player.inflation.vacuum;
    const challenge = player.challenges.active;

    activeAll.length = 0;
    if (vacuum) {
        activeAll.push(1);
        if (player.researchesExtra[1][2] >= 2) { activeAll.push(2); }
        if (current >= 2) { activeAll.push(3); } //player.researchesExtra[1][2] >= 1
        if (current >= 4) { activeAll.push(4); } //player.accretion.rank >= 6
        if (current >= 5 && player.strangeness[5][3] >= 1) { activeAll.push(5); } //player.elements[26] >= 1
    } else {
        if (current === 1 || player.milestones[1][1] >= 6) { stageInfo.activeAll.push(1); }
        if (current === 2 || player.milestones[2][1] >= 7) { stageInfo.activeAll.push(2); }
        if (current === 3 || player.milestones[3][1] >= 7) { stageInfo.activeAll.push(3); }
        if (current >= 4) { activeAll.push(4); }
        if (current >= 5) { activeAll.push(5); } //player.elements[26] >= 1
    }
    if (highest >= 7 || (player.event && highest === 6)) { activeAll.push(6); }
    if (offline && global.offline.active) {
        if (!global.offline.stageUpdate) { global.offline.stageUpdate = changed; }
        return;
    }

    for (let s = 1; s <= 6; s++) {
        for (const element of getClass(`stage${s}Only`)) { element.style.display = active === s ? '' : 'none'; }
        for (const element of getClass(`stage${s}Include`)) { element.style.display = activeAll.includes(s) ? '' : 'none'; }
    }

    const stageWord = getId('stageWord');
    stageWord.textContent = stageInfo.word[current];
    stageWord.style.color = `var(--${stageInfo.textColor[current]}-text)`;
    if ((challenge !== null && global.challengesInfo.resetType[challenge] === 'stage') || (!vacuum && active >= 6)) {
        getId('stageReset').textContent = 'No Stage resets available';
    } else if (vacuum || active >= 4) {
        getId('stageReset').textContent = highest >= 6 || (player.event && highest === 5) ? (current >= 5 ? 'Requirements are met' : "Requires '[26] Iron' Element") : 'Requirements are unknown';
    }
    if (challenge !== null) {
        getId('currentChallenge').style.display = '';
        const currentID = getQuery('#currentChallenge > span');
        currentID.textContent = global.challengesInfo.name[challenge];
        currentID.style.color = `var(--${global.challengesInfo.color[challenge]}-text)`;
    } else { getId('currentChallenge').style.display = 'none'; }

    if (highest < 7) {
        getId('stageSelect').style.display = activeAll.length > 1 ? '' : 'none';
        const showAll = vacuum && player.stage.resets >= 1;
        if (highest < 6) { getId('dischargeToggleReset').style.display = activeAll.includes(1) ? '' : 'none'; }
        getId('vaporizationToggleReset').style.display = showAll || activeAll.includes(2) ? '' : 'none';
        getId('rankToggleReset').style.display = showAll || activeAll.includes(3) ? '' : 'none';
        getId('collapseToggleReset').style.display = showAll || activeAll.includes(4) ? '' : 'none';
        getId('strangenessTabBtn').style.display = player.strange[0].total > 0 || (vacuum && current >= 5) ? '' : 'none';
        getId('inflationTabBtn').style.display = 'none';
        if (changed) {
            getId('resets').style.display = '';
            getId('researches').style.display = '';
        }
    }
    if (vacuum) {
        getId('milestonesProgressArea').style.display = challenge === 0 && player.inflation.tree[4] >= 1 ? '' : 'none';
    } else {
        const interstellar = (active >= 6 ? current : active) >= 4;
        getId('strange1Effect1Allowed').style.display = interstellar ? '' : 'none';
        getId('strange1Effect1Disabled').style.display = !interstellar ? '' : 'none';
        if (highest < 6) {
            for (let s = 2; s <= 4; s++) {
                const unlocked = player.stage.resets >= s + 3;
                getId(`strangeness${globalSave.MDSettings[0] ? 'Page' : 'Section'}${s}`).style.display = unlocked ? '' : 'none';
                getId(`milestone1Stage${s}Div`).style.display = unlocked ? '' : 'none';
                getId(`milestone2Stage${s}Div`).style.display = unlocked ? '' : 'none';
            }
        }
    }

    if (!changed) {
        visualUpdate();
        numbersUpdate();
        return;
    }
    if (globalSave.MDSettings[0]) {
        getId('reset1Footer').textContent = specialHTML.resetHTML[active];
    }
    if (globalSave.SRSettings[0]) {
        SRHotkeysInfo(true);
        for (let i = 1; i < buildingsInfo.maxActive[active]; i++) {
            getId(`building${i}`).ariaLabel = `${buildingsInfo.name[active][i]}, hotkeys are ${i} and Shift ${i})`;
        }
        getId('extraResearches').ariaLabel = `${['Energy', 'Cloud', 'Rank', 'Collapse', 'Galaxy', ''][active - 1]} Researches`;
        getId('SRStage').textContent = `Current active Stage is '${stageInfo.word[active]}'${active !== global.trueActive ? `, will be changed to '${stageInfo.word[global.trueActive]}' after changing tab` : ''}`;
    }

    const upgradesInfo = global.upgradesInfo[active];
    const researchesInfo = global.researchesInfo[active];
    const researchesExtraInfo = global.researchesExtraInfo[active];
    const footerStatsHTML = specialHTML.footerStatsHTML[active];
    for (let i = buildingsInfo.maxActive[active]; i < specialHTML.longestBuilding; i++) {
        getId(`building${i}Stats`).style.display = 'none';
        getId(`building${i}`).style.display = 'none';
    }
    for (let i = upgradesInfo.maxActive; i < specialHTML.longestUpgrade; i++) {
        getId(`upgrade${i + 1}`).style.display = 'none';
    }
    for (let i = researchesInfo.maxActive; i < specialHTML.longestResearch; i++) {
        getId(`research${i + 1}`).style.display = 'none';
    }
    for (let i = researchesExtraInfo.maxActive; i < specialHTML.longestResearchExtra; i++) {
        getId(`researchExtra${i + 1}`).style.display = 'none';
    }
    for (let i = footerStatsHTML.length; i < specialHTML.longestFooterStats; i++) {
        getId(`footerStat${i + 1}`).style.display = 'none';
    }

    const showU: number[] = []; //Upgrades
    const showR: number[] = []; //Researches
    const showRE: number[] = []; //ResearchesExtra
    const showF: number[] = []; //Footer stats
    if (active === 1) {
        showU.push(2, 3, 4, 5);
        showR.push(0, 1, 2, 3, 4, 5);
        showF.push(0, 1, 2);
        getId('specials').style.display = 'none';
        if (vacuum) {
            showU.push(0, 1);
            showRE.push(0, 2);
        } else {
            getId('upgrade1').style.display = 'none';
            getId('upgrade2').style.display = 'none';
            getId('extraResearches').style.display = 'none';
        }
    } else if (active === 2) {
        showU.push(0);
        showR.push(0, 1);
        showRE.push(0, 1);
        showF.push(0, 1);
        getId('specials').style.display = 'none';
        if (vacuum) { getId('stageInfo').style.display = ''; }
    } else if (active === 3) {
        showU.push(0, 1);
        showR.push(0, 1);
        showRE.push(0);
        showF.push(0);
        global.debug.rankUpdated = null;
        getId('specials').style.display = 'none';
        getId('reset1Main').style.display = '';
        if (vacuum) { getId('stageInfo').style.display = ''; }
    } else if (active === 4) {
        showU.push(0, 1, 2);
        showR.push(0, 1, 2);
        showRE.push(0);
        showF.push(0, 1);
        getId('stageInfo').style.display = '';
        getId('extraResearches').style.display = '';
        setRemnants();
    } else if (active === 5) {
        showRE.push(0);
        showF.push(0, 1, 2);
        getId('stageInfo').style.display = '';
        if (vacuum) {
            getId('building2').style.display = '';
            showU.push(0, 1);
            showR.push(0, 1);
            getId('extraResearches').style.display = '';
            getId('special2').style.display = 'none';
            getId('special3').style.display = 'none';
        } else {
            getId('reset1Button').textContent = 'Requires 22 Galaxies';
            getId('specials').style.display = 'none';
        }
        setRemnants();
    } else if (active === 6) {
        showF.push(0, 1);
        getId('stageInfo').style.display = '';
        getId('reset1Main').style.display = 'none';
        getId('specials').style.display = 'none';
        getId('extraResearches').style.display = 'none';
    }
    getId('buildings').style.display = '';
    getId('building1').style.display = '';
    getId('upgrades').style.display = '';
    getId('stageResearches').style.display = '';
    (getId('autoWaitInput') as HTMLInputElement).value = format(player.toggles.shop.wait[active], { type: 'input' });

    const buildingHTML = specialHTML.buildingHTML[active];
    const buildingName = buildingsInfo.name[active];
    const buildingType = buildingsInfo.type[active];
    const buildingHoverText = buildingsInfo.hoverText[active];
    for (let i = 1; i < buildingsInfo.maxActive[active]; i++) {
        (getQuery(`#building${i} > img`) as HTMLImageElement).src = `Used_art/${buildingHTML[i - 1]}`;
        getQuery(`#building${i}Stats > h4`).textContent = buildingName[i];
        getId(`building${i}Name`).textContent = buildingName[i];
        getQuery(`#building${i}ProdDiv > span`).textContent = buildingType[i - 1];
        getId(`building${i}ProdDiv`).title = buildingHoverText[i - 1];
        toggleSwap(i, 'buildings');
    }
    getQuery('#building0Stats > h4').textContent = buildingName[0];
    toggleSwap(0, 'buildings');

    const upgradeHTML = specialHTML.upgradeHTML[active];
    for (let i = 0; i < upgradesInfo.maxActive; i++) {
        const image = getId(`upgrade${i + 1}`) as HTMLInputElement;
        if (showU.includes(i)) { image.style.display = ''; }
        image.src = `Used_art/${upgradeHTML[i]}`;
        image.alt = upgradesInfo.name[i];
        visualUpdateUpgrades(i, active, 'upgrades');
    }

    const researchHTML = specialHTML.researchHTML[active];
    for (let i = 0; i < researchesInfo.maxActive; i++) {
        const main = getId(`research${i + 1}`);
        if (showR.includes(i)) { main.style.display = ''; }
        main.className = researchHTML[i][1];
        const image = getId(`research${i + 1}Image`) as HTMLInputElement;
        image.src = `Used_art/${researchHTML[i][0]}`;
        image.alt = researchesInfo.name[i];
        visualUpdateResearches(i, active, 'researches');
    }

    const researchExtraHTML = specialHTML.researchExtraHTML[active];
    for (let i = 0; i < researchesExtraInfo.maxActive; i++) {
        const main = getId(`researchExtra${i + 1}`);
        if (showRE.includes(i)) { main.style.display = ''; }
        main.className = researchExtraHTML[i][1];
        const image = getId(`researchExtra${i + 1}Image`) as HTMLInputElement;
        image.src = `Used_art/${researchExtraHTML[i][0]}`;
        image.alt = researchesExtraInfo.name[i];
        visualUpdateResearches(i, active, 'researchesExtra');
    }
    getQuery('#extraResearches > div').className = `researchesDiv ${specialHTML.researchExtraDivHTML[active][1]}`;
    (getQuery('#extraResearches > img') as HTMLImageElement).src = `Used_art/${specialHTML.researchExtraDivHTML[active][0]}`;
    visualUpdateResearches(0, active, 'ASR');

    for (let i = 0; i < footerStatsHTML.length; i++) {
        if (showF.includes(i)) { getId(`footerStat${i + 1}`).style.display = ''; }
        (getQuery(`#footerStat${i + 1} > img`) as HTMLImageElement).src = `Used_art/${footerStatsHTML[i][0]}`;
        getQuery(`#footerStat${i + 1} > p`).className = footerStatsHTML[i][1];
        getQuery(`#footerStat${i + 1} span`).textContent = footerStatsHTML[i][2];
    }

    const body = document.documentElement.style;
    body.setProperty('--stage-text', `var(--${stageInfo.textColor[active]}-text)`);
    body.setProperty('--stage-button-border', stageInfo.buttonBorder[active]);
    body.setProperty('--stage-image-borderColor', stageInfo.imageBorderColor[active]);
    body.setProperty('--image-border', `url("Used_art/Stage${active} border.png")`);
    getId('currentSwitch').textContent = stageInfo.word[active];

    visualUpdate();
    numbersUpdate();
    if (globalSave.theme === null) { setTheme(); }
};
