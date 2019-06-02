const fs = require('fs');
const parse = require('csv-parse');
const moment = require('moment');
const generate = require('csv-generate');
const { SNAP_HEADERS, IMPERIAL_HEADERS } = require('./headers');

class QuestionnaireDataTransformer {
    constructor(inputStreams, outputStream) { // inputStreams: ReadableStream[], outputStream: WriteableStream
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
    }

    async convert() {
        for (let i = 0; i < this.inputStreams.length; i++) {
            await this._convertOneStream(this.parseStreams[i]);
        }
        return true;
    }

    _convertOneStream(parser) {  // parser = this.inputStream[i]
        return new Promise((resolve, reject) => {
            parser.on('readable', () => {
                let line;
                line = parser.read();
                if (!line) throw new Error('Cannot read line.');

                /* check the source of the file */
                let SOURCE;
                const sourceIsImperial = this._checkWhichSourceRecordIsFrom(line, this.IMPERIAL_HEADERS); 
                const sourceIsSnap = this._checkWhichSourceRecordIsFrom(line, this.SNAP_HEADERS); 
                if ((sourceIsImperial && sourceIsSnap) || (!sourceIsImperial && !sourceIsSnap)) throw new Error('Cannot determine source.');
                if (sourceIsImperial) SOURCE = this.AVAILABLE_SOURCES.IMPERIAL;
                if (sourceIsSnap) SOURCE = this.AVAILABLE_SOURCES.SNAP;
            
                /* getting rid of waste lines */
                if (SOURCE = this.AVAILABLE_SOURCES.IMPERIAL) { parser.read(); parser.read(); }
            
                /* starting transformation */
                while (line = parser.read()) {
                    switch (SOURCE) {
                        case this.AVAILABLE_SOURCES.IMPERIAL:
                        {
                            /* collect analytic metadata */
                            // recordedDates.push(line.RecordedDate);
                            // recordedDurations.push(line['Duration (in seconds)']);

                            console.log(this._transformImperialRecord(line));
                            break;
                        }
                        case this.AVAILABLE_SOURCES.SNAP:
                            console.log('snap');
                            const record = {
                                studyId: '',
                                dateCompleted: line.RecordedDate,
                                episodesOfWheeze: '',
                                fever: '',
                                cold: '',
                                cough: '',
                                other_: '',
                                otherSymptoms: '',
                                blueInhaler: '',
                                brownInhaler: '',
                                anticholinergicInhaler: '',
                                oralCorticosteroid: '',
                                antibiotics: '',
                                other__: '',
                                none: '',
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
                                antiobiotics: '',
                            };
                            break;
                    }
                }
            });
            
            parser.on('end', () => {
                // for (let i = 0; i < recordedDates.length; i++){
                //     const date = moment(recordedDates[i], 'YYYY-MM-DD HH:mm');
                //     const hour = date.hour();
                //     const minute = date.minute();
                //     recordedDates[i] = hour * 60 + minute;
                // }
                parser.end();
                resolve();
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
            studyId: line.StudyID,
            siteId: line['Site ID'],
            dateCompleted: line.RecordedDate,
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
            infantStridor: soundclip === 'Sound clip 1' ? 'true' : '',
            adultStertor: soundclip === 'Sound clip 2' ? 'true' : '',
            adultWheeze: soundclip === 'Sound clip 3' ? 'true' : '',
            infantWheeze: soundclip === 'Sound clip 4' ? 'true' : '',
            unsure: '',
            antiobiotics: line.Q6,
        };
        return record;
    }
}


const inputStream = fs.createReadStream('./Survey+SMS+link_May+29,+2019_13.03.csv', { encoding: 'utf-8' });
const inputStream2 = fs.createReadStream('./Breathing+Together+email+survey_May+29,+2019_12.56.csv', { encoding: 'utf-8'});
const questionnaireDataTransformer = new QuestionnaireDataTransformer([inputStream, inputStream2]);
questionnaireDataTransformer.convert().then(() => {
    console.log('end');
});


