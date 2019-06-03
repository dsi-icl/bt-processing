const fs = require('fs');
const parse = require('csv-parse/lib/sync');

const pftsString = fs.readFileSync('./pfts.csv').toString();

let pfts = parse(pftsString, {
    skip_empty_lines: true
});

pfts.shift();

/* extract the subjid */
pfts = pfts.map(e => {
    const subjid = e[0];
    const idx = subjid.indexOf('(');
    const newSubjid = subjid.substring(0, idx);
    return [newSubjid, e[1], e[2]];
});

/* regex to extract sample number */
const problematicLines = [];
const SUBJ_MAP = {};


for (let i = 0; i < pfts.length; i++){
    const line = pfts[i];
    const subjid = line[0];
    let sampleMatches = line[1].match(/[A-Za-z][A-Za-z][A-Za-z]1\d\d\d\d\d/g) || [];
    let commentMatches = line[2].match(/[A-Za-z][A-Za-z][A-Za-z]1\d\d\d\d\d/g) || [];
    sampleMatches = sampleMatches.map(e => `${e}A`);
    commentMatches = commentMatches.map(e => `${e}A`);
    const matchSet = new Set(sampleMatches);
    commentMatches.forEach(e => {
        matchSet.add(e);
    });
    const extractedSamples = Array.from(matchSet);
    SUBJ_MAP[subjid] = {
        sampleId: line[1],
        comment: line[2],
        extractedSamples,
        subjid
    };
}

/* parse aliquot number */
const urine_aliquots = fs.readFileSync('./urine_aliquots.csv').toString();

let ali = parse(urine_aliquots, {
    skip_empty_lines: true
});
ali.shift();
const aliNumberMap = { };

for (let each of ali) {
    if (parseInt(each[1])) {
        aliNumberMap[each[0]] = parseInt(each[1]);
    }
}




////////////////////////////////////////
Object.keys(SUBJ_MAP).forEach(subjid => {
    if (aliNumberMap[subjid] === undefined) {
        SUBJ_MAP[subjid].aliquotNum = null;
        SUBJ_MAP[subjid].match = null;
    } else {
        SUBJ_MAP[subjid].aliquotNum = aliNumberMap[subjid];
        SUBJ_MAP[subjid].match = aliNumberMap[subjid] === SUBJ_MAP[subjid].extractedSamples.length;
    }
});


console.error('SUBJ_ID\tSAMPLE_ID_ENTERED\tCOMMENT\tALIQUOT_NUM\tMATCH\tALIQUOT1\tALIQUOT2\tALIQUOT3\tALIQUOT4\tALIQUOT5');

Object.keys(SUBJ_MAP).forEach(subjid => {
    const doc = SUBJ_MAP[subjid];
    console.error(`${subjid}\t${doc.sampleId}\t${doc.comment}\t${doc.aliquotNum || ''}\t${doc.match === null ? '' : JSON.stringify(doc.match)}\t${doc.extractedSamples[0] || ''}\t${doc.extractedSamples[1] || ''}\t${doc.extractedSamples[2] || ''}\t${doc.extractedSamples[3] || ''}\t${doc.extractedSamples[4] || ''}`);
});



console.log(SUBJ_MAP);