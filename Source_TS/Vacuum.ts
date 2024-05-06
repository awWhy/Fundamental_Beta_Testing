import { getId, getQuery } from './Main';
import { global, player, playerStart } from './Player';
import { resetVacuum } from './Reset';
import { Alert, Confirm, globalSave, playEvent, specialHTML } from './Special';

export const prepareVacuum = (state: boolean) => { //Must not use direct player values
    const { buildings } = playerStart;
    const { buildingsInfo, upgradesInfo, researchesInfo, researchesExtraInfo, strangenessInfo } = global;
    const star3ExpId = getId('star3Explanation');

    if (state) {
        specialHTML.footerStatsHTML[1][0] = ['Energy%20mass.png', 'stage1borderImage cyanText', 'Mass'];
        buildingsInfo.hoverText[2][0] = 'Tritium';
        buildingsInfo.hoverText[3][0] = 'Preons hardcap';
        buildings[1][0].current.setValue('5.476e-3');
        buildings[2][0].current.setValue('0');
        buildings[3][0].current.setValue('9.76185667392e-36');
        buildingsInfo.maxActive = [0, 6, 7, 6, 6, 4];
        if (buildingsInfo.name[1][0] !== 'Mass') {
            specialHTML.buildingHTML[1].unshift('Preon.png', 'Quarks.png');
            buildingsInfo.name[1].unshift('Mass', 'Preons');
            buildingsInfo.hoverText[1].unshift('Mass', 'Preons');
        }
        buildingsInfo.startCost[1] = [0, 0.005476, 6, 3, 24, 3];
        buildingsInfo.type[2][1] = 'improving';
        buildingsInfo.type[3][1] = 'delaying';
        buildingsInfo.increase[5][1] = 4;
        buildingsInfo.increase[5][2] = 4;
        star3ExpId.textContent = 'Boost to Solar mass gain and delay to Preons hardcap';

        const upgrades1Cost = [40, 60, 120, 140, 200, 400, 2000, 4000, 16000, 84000];
        upgradesInfo[1].startCost.splice(0, upgrades1Cost.length, ...upgrades1Cost);
        upgradesInfo[2].startCost[0] = 10;
        //upgradesInfo[1].maxActive = 10;
        upgradesInfo[2].maxActive = 9;
        //upgradesInfo[3].maxActive = 13;
        //upgradesInfo[4].maxActive = 4;
        //upgradesInfo[5].maxActive = 3;

        const researches1Cost = [2400, 6000, 20000, 36000, 20000, 28000];
        const researches1Scaling = [400, 2000, 8000, 48000, 16000, 16000];
        researchesInfo[1].startCost.splice(0, researches1Cost.length, ...researches1Cost);
        researchesInfo[1].scaling.splice(0, researches1Scaling.length, ...researches1Scaling);
        researchesInfo[2].scaling[2] = 1e2;
        researchesInfo[2].scaling[3] = 1e3;
        //researchesInfo[1].maxActive = 6;
        //researchesInfo[2].maxActive = 6;
        //researchesInfo[3].maxActive = 9;
        //researchesInfo[4].maxActive = 5;
        //researchesInfo[5].maxActive = 2;

        researchesExtraInfo[2].startCost[2] = 1e28;
        researchesExtraInfo[1].maxActive = 5;
        researchesExtraInfo[2].maxActive = 4;
        researchesExtraInfo[3].maxActive = 5;
        //researchesExtraInfo[4].maxActive = 3;
        //researchesExtraInfo[5].maxActive = 1;

        global.ASRInfo.costRange[1] = [4000, 12000, 20000, 36000, 60000];
        global.ASRInfo.costRange[3][3] = 2.45576045e31;

        const strangeness1Cost = [1, 2, 1, 4, 12, 2, 40];
        const strangeness1Scaling = [2.46, 4, 6, 8, 1, 1, 1];
        strangenessInfo[1].startCost.splice(0, strangeness1Cost.length, ...strangeness1Cost);
        strangenessInfo[1].scaling.splice(0, strangeness1Scaling.length, ...strangeness1Scaling);
        const strangeness2Cost = [1, 1, 2, 4, 12, 4, 40];
        const strangeness2Scaling = [2.46, 2, 3, 6, 800, 1, 1];
        strangenessInfo[2].startCost.splice(0, strangeness2Cost.length, ...strangeness2Cost);
        strangenessInfo[2].scaling.splice(0, strangeness2Scaling.length, ...strangeness2Scaling);
        const strangeness3Cost = [1, 2, 4, 16, 12, 4, 4, 40];
        const strangeness3Scaling = [2, 3.4, 2, 1, 500, 1, 1.74, 1];
        strangenessInfo[3].startCost.splice(0, strangeness3Cost.length, ...strangeness3Cost);
        strangenessInfo[3].scaling.splice(0, strangeness3Scaling.length, ...strangeness3Scaling);
        const strangeness4Cost = [1, 2, 4, 4, 12, 6, 6, 40];
        const strangeness4Scaling = [2, 3.4, 3, 4, 300, 1, 2, 1];
        strangenessInfo[4].startCost.splice(0, strangeness4Cost.length, ...strangeness4Cost);
        strangenessInfo[4].scaling.splice(0, strangeness4Scaling.length, ...strangeness4Scaling);
        const strangeness5Cost = [4, 80, 2400, 40, 60, 40, 60, 400];
        const strangeness5Scaling = [1, 4, 1, 2, 2, 1, 1, 1];
        strangenessInfo[5].startCost.splice(0, strangeness5Cost.length, ...strangeness5Cost);
        strangenessInfo[5].scaling.splice(0, strangeness5Scaling.length, ...strangeness5Scaling);
        strangenessInfo[1].maxActive = 10;
        strangenessInfo[2].maxActive = 9;
        strangenessInfo[3].maxActive = 9;
        strangenessInfo[4].maxActive = 9;
        strangenessInfo[5].maxActive = 9;

        getId('milestonesWelcome').innerHTML = 'Milestones, can only be done when inside the <span class="darkvioletText">Void</span>';
        const milestone1S1 = getQuery('#milestone1Stage1Div > img') as HTMLImageElement;
        milestone1S1.src = milestone1S1.src.replace('Quarks.png', 'Preon.png');
        const milestone1S2 = getQuery('#milestone1Stage2Div > img') as HTMLImageElement;
        global.milestonesInfo[2].name[0] = 'Distant Clouds';
        getId('milestone1Stage2Name').textContent = 'Distant Clouds';
        milestone1S2.src = milestone1S2.src.replace('Drop.png', 'Clouds.png');
        milestone1S2.alt = 'Distant Clouds';
        (getQuery('#milestone1Stage3Div > img') as HTMLImageElement).alt = 'Center of gravity';
        global.milestonesInfo[3].name[0] = 'Center of gravity';
        getId('milestone1Stage3Name').textContent = 'Center of gravity';
        getQuery('#stageHistory > h4').textContent = 'Stage resets:';

        getId('preonCap').style.display = '';
        getId('molesProduction').style.display = '';
        getId('massProduction').style.display = '';
        getId('dustCap').style.display = '';
        getId('mainCap').style.display = '';
        getId('strange7Stage1').style.display = '';
        getId('strange7Stage2').style.display = '';
        getId('strange8Stage3').style.display = '';
        getId('strange8Stage4').style.display = '';
        getId('strange6Stage5').style.display = '';
        for (let s = 2; s <= 5; s++) {
            getId(`strangeness${globalSave.MDSettings[0] ? 'Page' : 'Section'}${s}`).style.display = '';
            getId(`milestone1Stage${s}Div`).style.display = '';
            getId(`milestone2Stage${s}Div`).style.display = '';
        }
        getId('vacuumBoost').style.display = 'none';
        getId('stageInstant').style.display = 'none';
        getId('unknownStructures').style.display = 'none';
    } else {
        specialHTML.footerStatsHTML[1][0] = ['Quarks.png', 'stage1borderImage cyanText', 'Quarks'];
        buildingsInfo.hoverText[2][0] = 'Moles';
        buildingsInfo.hoverText[3][0] = 'Mass';
        buildings[1][0].current.setValue('3');
        buildings[2][0].current.setValue('2.8e-3');
        buildings[3][0].current.setValue('1e-19');
        if (buildingsInfo.name[1][0] === 'Mass') {
            specialHTML.buildingHTML[1].splice(0, 2);
            buildingsInfo.name[1].splice(0, 2);
            buildingsInfo.hoverText[1].splice(0, 2);
        }
        buildingsInfo.maxActive = [0, 4, 6, 5, 5, 4];
        buildingsInfo.startCost[1] = [0, 3, 24, 3];
        buildingsInfo.type[2][1] = 'producing';
        buildingsInfo.type[3][1] = 'producing';
        buildingsInfo.increase[5][1] = 2;
        buildingsInfo.increase[5][2] = 2;
        star3ExpId.textContent = 'Boost to Solar mass gain';

        const upgrades1Cost = [0, 0, 9, 12, 36, 300, 800, 2000, 4000, 22000];
        upgradesInfo[1].startCost.splice(0, upgrades1Cost.length, ...upgrades1Cost);
        upgradesInfo[2].startCost[0] = 1e4;
        upgradesInfo[1].maxActive = 10;
        upgradesInfo[2].maxActive = 8;
        upgradesInfo[3].maxActive = 13;
        upgradesInfo[4].maxActive = 4;
        upgradesInfo[5].maxActive = 3;

        const researches1Cost = [1000, 2500, 6000, 8000, 8000, 6000];
        const researches1Scaling = [250, 500, 2000, 8000, 4000, 6000];
        researchesInfo[1].startCost.splice(0, researches1Cost.length, ...researches1Cost);
        researchesInfo[1].scaling.splice(0, researches1Scaling.length, ...researches1Scaling);
        researchesInfo[2].scaling[2] = 1e3;
        researchesInfo[2].scaling[3] = 1e2;
        researchesInfo[1].maxActive = 6;
        researchesInfo[2].maxActive = 6;
        researchesInfo[3].maxActive = 9;
        researchesInfo[4].maxActive = 5;
        researchesInfo[5].maxActive = 2;

        researchesExtraInfo[2].startCost[2] = 1e26;
        researchesExtraInfo[1].maxActive = 0;
        researchesExtraInfo[2].maxActive = 3;
        researchesExtraInfo[3].maxActive = 4;
        researchesExtraInfo[4].maxActive = 3;
        researchesExtraInfo[5].maxActive = 1;

        global.ASRInfo.costRange[1] = [6000, 12000, 18000];
        global.ASRInfo.costRange[3][3] = 2e30;

        const strangeness1Cost = [1, 1, 1, 2, 4, 2, 24];
        const strangeness1Scaling = [1, 1, 1.5, 3, 0, 0, 0];
        strangenessInfo[1].startCost.splice(0, strangeness1Cost.length, ...strangeness1Cost);
        strangenessInfo[1].scaling.splice(0, strangeness1Scaling.length, ...strangeness1Scaling);
        const strangeness2Cost = [1, 1, 2, 2, 4, 2, 24];
        const strangeness2Scaling = [0.5, 0.75, 2.5, 3, 0, 0, 0];
        strangenessInfo[2].startCost.splice(0, strangeness2Cost.length, ...strangeness2Cost);
        strangenessInfo[2].scaling.splice(0, strangeness2Scaling.length, ...strangeness2Scaling);
        const strangeness3Cost = [1, 1, 2, 6, 4, 2, 6, 24];
        const strangeness3Scaling = [0.75, 1.5, 2, 0, 0, 0, 6, 0];
        strangenessInfo[3].startCost.splice(0, strangeness3Cost.length, ...strangeness3Cost);
        strangenessInfo[3].scaling.splice(0, strangeness3Scaling.length, ...strangeness3Scaling);
        const strangeness4Cost = [1, 1, 3, 2, 4, 2, 4, 24];
        const strangeness4Scaling = [1, 2, 2.5, 3, 0, 0, 76, 0];
        strangenessInfo[4].startCost.splice(0, strangeness4Cost.length, ...strangeness4Cost);
        strangenessInfo[4].scaling.splice(0, strangeness4Scaling.length, ...strangeness4Scaling);
        const strangeness5Cost = [80, 80, 40, 20, 24, 24, 20, 240];
        const strangeness5Scaling = [80, 0, 0, 20, 24, 0, 0, 0];
        strangenessInfo[5].startCost.splice(0, strangeness5Cost.length, ...strangeness5Cost);
        strangenessInfo[5].scaling.splice(0, strangeness5Scaling.length, ...strangeness5Scaling);
        strangenessInfo[1].maxActive = 7;
        strangenessInfo[2].maxActive = 7;
        strangenessInfo[3].maxActive = 8;
        strangenessInfo[4].maxActive = 8;
        strangenessInfo[5].maxActive = 8;

        getId('milestonesWelcome').innerHTML = 'Any reached Milestone will award 1 <span class="greenText">Strange quark</span>';
        const milestone1S1 = getQuery('#milestone1Stage1Div > img') as HTMLImageElement;
        milestone1S1.src = milestone1S1.src.replace('Preon.png', 'Quarks.png');
        const milestone1S2 = getQuery('#milestone1Stage2Div > img') as HTMLImageElement;
        global.milestonesInfo[2].name[0] = 'A Nebula of Drops';
        getId('milestone1Stage2Name').textContent = 'A Nebula of Drops';
        milestone1S2.src = milestone1S2.src.replace('Clouds.png', 'Drop.png');
        milestone1S2.alt = 'A Nebula of Drops';
        (getQuery('#milestone1Stage3Div > img') as HTMLImageElement).alt = 'Cluster of Mass';
        global.milestonesInfo[3].name[0] = 'Cluster of Mass';
        getId('milestone1Stage3Name').textContent = 'Cluster of Mass';
        getQuery('#stageHistory > h4').textContent = 'Interstellar Stage resets:';

        getId('vacuumBoost').style.display = '';
        getId('strange8Stage5').style.display = '';
        getId('milestonesProgressArea').style.display = '';
        getId('stageInstant').style.display = '';
        getId('rankStat0').style.display = '';

        getId('preonCap').style.display = 'none';
        getId('molesProduction').style.display = 'none';
        getId('massProduction').style.display = 'none';
        getId('dustCap').style.display = 'none';
        getId('submersionBoost').style.display = 'none';
        getId('mainCap').style.display = 'none';
        getId('researchAuto1').style.display = 'none';
        for (let s = 1; s < strangenessInfo.length; s++) {
            for (let i = strangenessInfo[s].maxActive + 1; i <= strangenessInfo[s].startCost.length; i++) {
                getId(`strange${i}Stage${s}`).style.display = 'none';
            }
        }
    }

    if (globalSave.SRSettings[0]) { star3ExpId.textContent = ` (${star3ExpId.textContent})`; }
    for (let s = 1; s <= 3; s++) {
        const newValue = buildings[s][0].current;
        buildings[s][0].total.setValue(newValue);
        buildings[s][0].trueTotal.setValue(newValue);
        buildings[s][0].highest.setValue(newValue);
    }
};

export const switchVacuum = async() => {
    if (player.inflation.vacuum) { return void Alert('This cannot be undone'); }
    const count = global.strangeInfo.instability;
    if (count < 5) { return void Alert(`Universe is still stable. Vacuum state is false. ${5 - count} more`); }

    if (!await Confirm('This will not be possible to undo. Confirm?\n(This will reset everything)')) { return; }
    if (player.stage.true < 6) {
        await playEvent(6, -1);

        player.stage.true = 6;
        player.collapse.show = 0;
    }
    player.inflation.vacuum = true;
    player.stage.current = 1;
    player.stage.active = 1;
    prepareVacuum(true);
    resetVacuum();
};

export const updateUnknown = () => {
    const milestones = player.milestones;

    let text = '<h4 class="darkvioletText">Unknown Structures:</h4>';
    if (milestones[1][0] >= 6) { text += '<img src="Used_art/Preon.png" alt="Unknown Structure" loading="lazy" draggable="false">'; }
    if (milestones[2][1] >= 7) { text += '<img src="Used_art/Ocean.png" alt="Unknown Structure" loading="lazy" draggable="false">'; }
    if (milestones[3][1] >= 7) { text += '<img src="Used_art/Subsatellite.png" alt="Unknown Structure" loading="lazy" draggable="false">'; }
    if (milestones[4][1] >= 8) { text += '<img src="Used_art/Quasi%20star.png" alt="Unknown Structure" loading="lazy" draggable="false">'; }

    const div = getId('unknownStructures');
    div.style.display = global.strangeInfo.instability > 0 ? '' : 'none';
    if (div.innerHTML !== text) { div.innerHTML = text; }
};
