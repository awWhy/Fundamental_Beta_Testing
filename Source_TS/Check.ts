import Limit from './Limit';
import { global, player } from './Player';

export const checkTab = (tab: string, subtab = null as null | string): boolean => {
    switch (tab) {
        case 'stage':
            if (subtab === 'Advanced') { return player.inflation.vacuum || player.milestones[1][0] >= 5 || player.milestones[2][1] >= 4 || player.milestones[3][1] >= 5 || player.milestones[4][1] >= 5 || player.milestones[5][1] >= 8; }
            return subtab === 'Structures' || subtab === null;
        case 'Elements':
        case 'research':
            if (player.stage.resets < 1 && player.discharge.current < 4) { return false; }
            if (subtab === 'Elements' || tab === 'Elements') { return (global.stageInfo.activeAll.includes(4)) && player.upgrades[4][1] === 1; }
            return subtab === 'Researches' || subtab === null;
        case 'strangeness':
            if (player.strange[0].total === 0) { return false; }
            if (subtab === 'Milestones') { return player.strangeness[5][8] >= 1 || !player.inflation.vacuum; }
            return subtab === 'Matter' || subtab === null;
        case 'settings':
            if (subtab === 'History') { return player.strange[0].total > 0; }
            return subtab === 'Settings' || subtab === 'Stats' || subtab === null;
        case 'special':
            return global.screenReader;
    }

    return false;
};

export const checkBuilding = (index: number, stageIndex: number): boolean => {
    if (global.buildingsInfo.maxActive[stageIndex] < index + 1) { return false; }

    if (stageIndex === 1) {
        return true;
    } else if (stageIndex === 2) {
        if (index === 6) { return player.strangeness[2][9] >= 1; }
        return true;
    } else if (stageIndex === 3) {
        if (player.accretion.rank === 0) { return false; }
        if (index === 1) { return true; }
        if (index === 2) { return player.upgrades[3][2] === 1; }
        if (index === 3) { return player.upgrades[3][4] === 1; }
        if (index === 4) { return player.upgrades[3][6] === 1; }
        if (index === 5) { return player.upgrades[3][6] === 1 && player.strangeness[3][8] >= 1 && player.accretion.rank >= 5; }
    } else if (stageIndex === 4) {
        if (player.collapse.mass < global.collapseInfo.unlockB[index]) { return false; }
        if (index === 1 || index === 4) { return true; }
        if (index === 2) { return player.inflation.vacuum || player.upgrades[4][1] === 1; }
        if (index === 3) { return player.inflation.vacuum || player.upgrades[4][2] === 1; }
        if (index === 5) { return player.strangeness[4][10] >= 1; }
    } else if (stageIndex === 5) {
        if (player.collapse.mass < global.collapseInfo.unlockG[index]) { return false; }
        if (index === 1) { return player.inflation.vacuum || player.milestones[2][0] >= 3; }
        if (index === 2) { return player.inflation.vacuum || player.milestones[3][0] >= 3; }
        if (index === 3) { return player.strangeness[5][6] >= 1; }
        if (index === 4) { return false; }
    }

    return false;
};

export const checkUpgrade = (upgrade: number, stageIndex: number, type: 'upgrades' | 'researches' | 'researchesExtra' | 'researchesAuto' | 'ASR' | 'elements' | 'strangeness'): boolean => {
    if (stageIndex === 3 && player.accretion.rank === 0 && type !== 'strangeness') { return false; }

    switch (type) { //Some cases are handled by max level being 0
        case 'upgrades':
            if (global.upgradesInfo[stageIndex].maxActive < upgrade + 1) { return false; }
            if (stageIndex === 1) {
                if (upgrade === 0 || upgrade === 1) { return player.inflation.vacuum; }
                if (upgrade > 5) { return player.discharge.current >= 3; }
                return true;
            } else if (stageIndex === 2) {
                if (upgrade === 6) { return player.strangeness[2][2] >= 3; }
                if (upgrade === 7) { return player.strangeness[2][9] >= 2; }
                return true;
            } else if (stageIndex === 3) {
                if (upgrade === 8 && player.strangeness[3][2] < 3) { return false; }
                return player.accretion.rank >= global.accretionInfo.rankU[upgrade];
            } else if (stageIndex === 4) {
                if (upgrade === 3 && player.strangeness[4][2] < 1) { return false; }
                if (upgrade >= 2 && player.upgrades[4][upgrade - 1] !== 1) { return false; }
                return player.collapse.mass >= global.collapseInfo.unlockU[upgrade];
            } else if (stageIndex === 5) {
                if (upgrade === 0) { return player.inflation.vacuum || player.milestones[2][0] >= 3; }
                if (upgrade === 1) { return player.inflation.vacuum || player.milestones[3][0] >= 3; }
                if (upgrade === 2) { return player.buildings[5][3].true >= 1; }
            }
            break;
        case 'researches':
            if (global.researchesInfo[stageIndex].maxActive < upgrade + 1) { return false; }
            if (stageIndex === 1) {
                return player.upgrades[1][5] === 1;
            } else if (stageIndex === 2) {
                return true;
            } else if (stageIndex === 3) {
                return player.accretion.rank >= global.accretionInfo.rankR[upgrade];
            } else if (stageIndex === 4) {
                if (upgrade === 3 && player.strangeness[4][2] < 2) { return false; }
                return player.collapse.mass >= global.collapseInfo.unlockR[upgrade];
            } else if (stageIndex === 5) {
                if (upgrade === 0) { return player.inflation.vacuum || player.milestones[2][0] >= 3; }
                if (upgrade === 1) { return player.inflation.vacuum || player.milestones[3][0] >= 3; }
            }
            break;
        case 'researchesExtra':
            if (global.researchesExtraInfo[stageIndex].maxActive < upgrade + 1) { return false; }
            if (stageIndex === 1) {
                if (player.discharge.current < 5) { return false; }
                if (upgrade === 1) { return player.researchesExtra[1][2] >= 2; }
                if (upgrade === 4) { return player.accretion.rank >= 6; }
                return true;
            } else if (stageIndex === 2) {
                return Limit(player.vaporization.clouds).moreThan('1');
            } else if (stageIndex === 3) {
                return player.accretion.rank >= global.accretionInfo.rankE[upgrade];
            } else if (stageIndex === 4) {
                if (upgrade === 1) { return player.strangeness[4][2] >= 3; }
                return player.buildings[4][2].trueTotal[0] > 0;
            }
            break;
        case 'researchesAuto':
            if (stageIndex === 1 && player.upgrades[1][5] < 1) { return false; }
            return stageIndex === global.researchesAutoInfo.autoStage[upgrade];
        case 'ASR':
            if (stageIndex === 1) { return player.upgrades[1][5] >= 1; }
            return true;
        case 'elements':
            if (upgrade >= 27) { return player.upgrades[4][3] === 1; }
            if (upgrade >= 11) { return player.collapse.mass >= 10 || player.buildings[5][3].true > 0; }
            if (upgrade >= 6) { return player.upgrades[4][2] === 1; }
            return player.upgrades[4][1] === 1;
        case 'strangeness':
            if (global.strangenessInfo[stageIndex].maxActive < upgrade + 1) { return false; }
            if (player.inflation.vacuum) {
                if (stageIndex === 1) {
                    if (upgrade === 9) { return player.challenges.void[1] >= 1; }
                    if (upgrade === 10) { return player.challenges.void[1] >= 4; }
                    if (upgrade === 11) { return player.challenges.void[4] >= 2; }
                } else if (stageIndex === 2) {
                    if (upgrade === 9) { return player.strangeness[2][5] >= 5; }
                    if (upgrade === 10) { return player.challenges.void[2] >= 3 && player.strangeness[1][11] >= 1; }
                } else if (stageIndex === 3) {
                    if (upgrade === 8) { return player.strangeness[3][5] >= 4; }
                    if (upgrade === 10) { return player.challenges.void[1] >= 2; }
                    if (upgrade === 11) { return player.challenges.void[1] >= 3; }
                } else if (stageIndex === 4) {
                    if (upgrade === 8) { return player.strangeness[4][7] >= 3; }
                    if (upgrade === 10) { return player.strangeness[4][6] >= 4; }
                    if (upgrade === 11) { return player.challenges.void[4] >= 3; }
                } else if (stageIndex === 5) {
                    if (upgrade === 8) { return player.challenges.void[4] >= 1; }
                    if (upgrade === 9) { return player.challenges.void[3] >= 5; }
                }
                return upgrade < 10;
            }
            if (((stageIndex === 1 || stageIndex === 4) && upgrade < 8) || ((stageIndex === 2 || stageIndex === 3) && upgrade < 7)) { return true; }
            if (stageIndex === 4 && upgrade === 8 && player.stage.true >= 6 && player.strangeness[4][7] < 3) { return false; }
            return player.milestones[4][0] >= 3;
    }

    return false;
};

export const allowedToBeReset = (check: number, stageIndex: number, type: 'structures' | 'upgrades' | 'researches' | 'researchesExtra' | 'elements'): boolean => {
    switch (type) {
        case 'structures':
            if (stageIndex === 5 && check === 3) { return false; }
            break;
        case 'upgrades':
            if (stageIndex === 1) {
                if (check === 5) { return false; }
            } else if (stageIndex === 2) {
                if (check === 1) { return false; }
            } else if (stageIndex === 4) {
                return false;
            } else if (stageIndex === 5) {
                if (check === 2) { return player.inflation.vacuum; }
            }
            break;
        case 'researches':
            if (stageIndex === 1) {
                if (check === 3) { return false; }
            } else if (stageIndex === 2) {
                if (check === 1) { return false; }
            }
            break;
        case 'researchesExtra':
            if (stageIndex === 1) {
                if (check === 2) { return false; }
            } else if (stageIndex === 2) {
                if (check === 0 || check === 3) { return false; }
            } else if (stageIndex === 4) {
                if (check === 0) { return false; }
            }
            break;
        case 'elements':
            if (check === 26 || check === 27 || check === 28) { return false; }
    }

    return true;
};

export const milestoneCheck = (index: number, stageIndex: number): boolean => {
    if (player.inflation.vacuum) {
        if (player.strangeness[5][8] < 1 || player.challenges.active !== 0) { return false; }
    } else if (player.strange[0].total === 0 || (stageIndex === 5 && player.strangeness[5][8] < 1)) { return false; }
    const need = global.milestonesInfo[stageIndex].need[index];
    if (need[0] === 0) { return false; }

    if (stageIndex === 1) {
        if (index === 0) { return Limit(player.buildings[1][player.inflation.vacuum ? 1 : 0].current).moreOrEqual(need); }
        if (index === 1) { return Limit(player.discharge.energy).moreOrEqual(need); }
    } else if (stageIndex === 2) {
        if (index === 0) { return Limit(player.inflation.vacuum ? player.vaporization.clouds : player.buildings[2][1].current).moreOrEqual(need); }
        if (index === 1) { return Limit(player.buildings[2][2].current).moreOrEqual(need); }
    } else if (stageIndex === 3) {
        if (index === 0) { return Limit(player.buildings[3][0].current).moreOrEqual(need); }
        if (index === 1) { return Limit(player.buildings[3][4].true + player.buildings[3][5].true).moreThan(need); }
    } else if (stageIndex === 4) {
        if (index === 0) { return Limit(player.inflation.vacuum ? player.buildings[4][0].current : player.collapse.mass).moreOrEqual(need); }
        if (index === 1) { return Limit(player.collapse.stars[2]).moreOrEqual(need); }
    } else if (stageIndex === 5) {
        if (index === 0) { return Limit(player.inflation.vacuum ? player.buildings[5][0].current : global.collapseInfo.trueStars).moreOrEqual(need); }
        if (index === 1) { return Limit(player.buildings[5][player.inflation.vacuum ? 4 : 3].current).moreOrEqual(need); }
    }
    return false;
};
