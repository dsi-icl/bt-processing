const parse = require('csv-parse');
const moment = require('moment');
// const { SNAP_HEADERS, IMPERIAL_HEADERS } = require('./headers');

function formatLine(record) {
    const keys = Object.keys(record);
    let string = '';
    for (let each of keys) {
        string += `\t${record[each]}`;
    }
    return string.substring(1, string.length) + '\n';
}

const record = {
    studyId: '',
    siteId: '', 
    completed: '',
    dateCompleted: '',
    episodesOfWheeze: '',
    fever: '',
    cold: '',
    cough: '',
    haveOtherSymtoms: '',
    otherSymptoms: '',
    blueInhaler: '',
    brownInhaler: '', 
    anticholinergicInhaler: '',
    oralCorticosteroid: '',
    antibiotics: '',
    none: '',
    haveOtherTreatments: '',
    otherTreatment: '',
    parents: '',
    communityNurse: '',
    GP: '',
    emergencyDepartment: '',
    outpatients: '',
    paediatricAssessmentUnit: '',
    paediatricWard: '',
    paediatricICU: '',
    other: '',
    otherProvider: '',
    infantStridor: '',
    adultStertor: '',
    adultWheeze: '',
    infantWheeze: '',
    unsure: '',
    antiobiotics: ''
};

const IMPERIAL_HEADERS = [
    'StartDate',
    'EndDate',
    'Progress',
    'Duration (in seconds)',
    'Finished',
    'RecordedDate',
    'Q1',
    'Q2',
    'Q2_4_TEXT',
    'Q3',
    'Q3_8_TEXT',
    'Q4',
    'Q4_9_TEXT',
    'Q5',
    'Q6',
    'Study ID'
];

const SNAP_HEADERS = [
    'ID.format',
    'ID.completed',
    'ID.date',
    'ID.start',
    'ID.endDate',
    'ID.end',
    'ID.time',
    'ID.name',
    'ID.site',
    'Q1',
    'Q2:1',
    'Q2:2',
    'Q2:3',
    'Q2:4',
    'Q2a',
    'Q3:1',
    'Q3:2',
    'Q3:3',
    'Q3:4',
    'Q3:5',
    'Q3:6',
    'Q3:7',
    'Q3a',
    'Q4:1',
    'Q4:2',
    'Q4:3',
    'Q4:4',
    'Q4:5',
    'Q4:6',
    'Q4:7',
    'Q4:8',
    'Q4:9',
    'Q4a',
    'Q5:1',
    'Q5:2',
    'Q5:3',
    'Q5:4',
    'Q5:5',
    'Q6'
];

class QuestionnaireDataTransformer {
    constructor(inputStreams, outputStream, analyticOutputStream) { // inputStreams: ReadableStream[], outputStream: WriteableStream
        this.analyticOutputStream = analyticOutputStream;
        this.inputStreams = inputStreams;
        this.outputStream = outputStream;
        this.SNAP_HEADERS = SNAP_HEADERS;
        this.IMPERIAL_HEADERS = IMPERIAL_HEADERS;
        this.AVAILABLE_SOURCES = {
            SNAP: 'SNAP',
            IMPERIAL: 'IMPERIAL'
        };
        this.parseStreams = [];
        for (let i = 0; i < inputStreams.length; i++) {
            this.parseStreams.push(parse({ columns: true }));
            inputStreams[i].pipe(this.parseStreams[i]);
        }

        /* analytics */
        this.DOBS = SUBJ_DOBS;
        this.records = []; // { DOB: number, Date_survey: number, Age_at_report: number, studyId: string, episodesOfWheeze: number, clip: string }[]
    }

    async convert() {
        this.outputStream.write(Object.keys(record).join('\t') + '\n');
        for (let i = 0; i < this.inputStreams.length; i++) {
            await this._convertOneStream(this.parseStreams[i]);
        }

        this.records.sort((a, b) => a.studyId.localeCompare(b.studyId) || b.date_survey_number - a.date_survey_number );
        this.analyticOutputStream.write('studyId\tDOB\tdate_survey\tage_at_survey\tnum_episode_wheeze\tsound_clip\n');
        for(let each of this.records) {
            this.analyticOutputStream.write(`${each.studyId}\t${each.DOB}\t${each.date_survey}\t${each.age_at_survey}\t${each.num_episode_wheeze}\t${each.sound_clip}\n`);
        }
        return true;
    }

    _convertOneStream(parser) {  // parser = this.inputStream[i]
        return new Promise((resolve, reject) => {
            let lineNum = 1;
            let SOURCE;

            parser.on('error', err => { console.error(err); reject(err); });

            parser.on('end', () => { parser.end(); resolve(); });

            parser.on('data', (line) => {
                if (!line) reject('Cannot read line.');

                /* check the source of the file */

                if (lineNum === 1) {
                    const sourceIsImperial = this._checkWhichSourceRecordIsFrom(line, this.IMPERIAL_HEADERS); 
                    const sourceIsSnap = this._checkWhichSourceRecordIsFrom(line, this.SNAP_HEADERS); 
                    if ((sourceIsImperial && sourceIsSnap) || (!sourceIsImperial && !sourceIsSnap)) reject('Cannot determine source.');
                    if (sourceIsImperial) SOURCE = this.AVAILABLE_SOURCES.IMPERIAL;
                    if (sourceIsSnap) SOURCE = this.AVAILABLE_SOURCES.SNAP;
                    lineNum += 1;
                    return;
                }
            
                /* getting rid of waste lines */
                if (SOURCE === this.AVAILABLE_SOURCES.IMPERIAL && lineNum === 2) { lineNum += 1;  return; }
            
                /* starting transformation */
                let transformedLine;
                switch (SOURCE) {
                    case this.AVAILABLE_SOURCES.IMPERIAL:
                    {
                        transformedLine = this._transformImperialRecord(line);
                        break;
                    }
                    case this.AVAILABLE_SOURCES.SNAP:
                    {
                        transformedLine = this._transformSnapRecord(line);
                        break;
                    }
                }
                this.outputStream.write(formatLine(transformedLine));

                /* analytics */
                const DOB = (this.DOBS[transformedLine.studyId] && moment(this.DOBS[transformedLine.studyId], 'DD/MM/YYYY')) || null ;
                const date_survey = moment(transformedLine.dateCompleted, 'DD/MM/YYYY hh:mm:ss') || null;
                const age_at_survey = DOB && date_survey ? date_survey.diff(DOB, 'months') : '';
                
                this.records.push({
                    studyId: transformedLine.studyId,
                    DOB: this.DOBS[transformedLine.studyId] || '',
                    date_survey: transformedLine.dateCompleted || '',
                    date_survey_number: (date_survey && date_survey.valueOf()) || null,
                    age_at_survey,
                    num_episode_wheeze: transformedLine.episodesOfWheeze,
                    sound_clip: transformedLine.infantStridor || transformedLine.adultStertor || transformedLine.adultWheeze || transformedLine.infantWheeze
                });


                lineNum += 1;
            });
        });
    }

    _checkWhichSourceRecordIsFrom(record, headers) {
        const keys = Object.keys(record);
        for (let each of headers) {
            if (keys.indexOf(each) === -1) {
                return false;
            }
        }
        return true;
    }


    _transformImperialRecord(line) {
        const symptoms = line.Q2;
        const treatments = line.Q3;
        const personnale = line.Q4;
        const soundclip = line.Q5;
        const record = {
            studyId: line['Study ID'],
            siteId: line['Study ID'].substring(0, 1),
            completed: line['Progress'] === '100' ? 'Yes' : 'No',
            dateCompleted: line.RecordedDate + ':00',
            episodesOfWheeze: line.Q1,
            fever: symptoms.indexOf('fever') === -1 ? '' : 'true',
            cold: symptoms.indexOf('cold') === -1 ? '' : 'true',
            cough: symptoms.indexOf('cough') === -1 ? '' : 'true',
            haveOtherSymtoms: symptoms.indexOf('other') === -1 ? '' : 'true',
            otherSymptoms: line.Q2_4_TEXT,
            blueInhaler: treatments.indexOf('blue inhaler') === -1 ? '' : 'true',
            brownInhaler: treatments.indexOf('brown inhaler') === -1 ? '' : 'true', 
            anticholinergicInhaler: treatments.indexOf('anticholinergic inhaler') === -1 ? '' : 'true',
            oralCorticosteroid: treatments.indexOf('oral') === -1 ? '' : 'true',
            antibiotics: treatments.indexOf('antibiotics') === -1 ? '' : 'true',
            none: treatments.indexOf('none') === -1 ? '' : 'true',
            haveOtherTreatments: treatments.indexOf('other') === -1 ? '' : 'true',
            otherTreatment: line.Q3_8_TEXT,
            parents: personnale.indexOf('Parents only') === -1 ? '' : 'true',
            communityNurse: personnale.indexOf('community nurse') === -1 ? '' : 'true',
            GP: personnale.indexOf('general practitioner') === -1 ? '' : 'true',
            emergencyDepartment: personnale.indexOf('emergency department') === -1 ? '' : 'true',
            outpatients: personnale.indexOf('parents') === -1 ? '' : 'true',
            paediatricAssessmentUnit: '',
            paediatricWard: personnale.indexOf('paediatric ward') === -1 ? '' : 'true',
            paediatricICU: '',
            other: personnale.indexOf('other') === -1 ? '' : 'true',
            otherProvider: line.Q4_9_TEXT,
            infantStridor: soundclip === 'Sound clip 1' ? 'clip_1' : '',
            adultStertor: soundclip === 'Sound clip 2' ? 'clip_2' : '',
            adultWheeze: soundclip === 'Sound clip 3' ? 'clip_3' : '',
            infantWheeze: soundclip === 'Sound clip 4' ? 'clip_4' : '',
            unsure: '',
            antiobiotics: line.Q6,
        };
        return record;
    }

    _transformSnapRecord(line) {
        const record = {
            studyId: line['ID.name'],
            siteId: line['ID.name'].substring(0, 1),
            completed: line['ID.completed'] === 'completed' ? 'Yes' : 'No',
            dateCompleted: line['ID.date'] + ' ' + line['ID.start'],
            episodesOfWheeze: line.Q1,
            fever: line['Q2:1'] && 'true',
            cold: line['Q2:2'] && 'true',
            cough: line['Q2:3'] && 'true',
            haveOtherSymtoms: line['Q2:4'] && 'true',
            otherSymptoms: line['Q2a'] && 'true',
            blueInhaler: line['Q3:1'] && 'true',
            brownInhaler: line['Q3:2'] && 'true',
            anticholinergicInhaler: line['Q3:3'] && 'true',
            oralCorticosteroid: line['Q3:4'] && 'true',
            antibiotics: line['Q3:5'] && 'true',
            none: line['Q3:7'] && 'true',
            haveOtherTreatments: line['Q3:6'] && 'true',
            otherTreatment: line['Q3a'],
            parents: line['Q4:1'] && 'true',
            communityNurse: line['Q4:2'] && 'true',
            GP: line['Q4:3'] && 'true',
            emergencyDepartment: line['Q4:4'] && 'true',
            outpatients: line['Q4:5'] && 'true',
            paediatricAssessmentUnit: line['Q4:6'] && 'true',
            paediatricWard: line['Q4:7'] && 'true',
            paediatricICU: line['Q4:8'] && 'true',
            other: line['Q4:9'] && 'true',
            otherProvider: line['Q4a'],
            infantStridor: line['Q5:1'] && 'clip_1',
            adultStertor: line['Q5:2'] && 'clip_2',
            adultWheeze: line['Q5:3'] && 'clip_3',
            infantWheeze: line['Q5:4'] && 'clip_4',
            unsure: line['Q5:5'] && 'true',
            antiobiotics: line.Q6
        };
        return record;
    }
}


