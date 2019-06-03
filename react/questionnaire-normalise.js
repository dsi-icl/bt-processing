'use strict';
const fs = require('fs');

class QuestionnaireConvert extends React.Component {
  constructor(props) {
    super(props);
    this.state = { files: [], converting: false, downloadPath: '', error: null };
  }

  _onDrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files) {
          const newFiles = [...this.state.files];
          for (let each of e.dataTransfer.files) {
              const filter = newFiles.filter(el => el.path === each.path);
              if (filter.length === 0){
                  newFiles.push(each);
              }
          }
          this.setState({ files: newFiles });
      } else if (e.dataTransfer.items) {
          const newFiles = [...this.state.files];
          for (let each of e.dataTransfer.items) {
              const filter = newFiles.filter(el => el.path === each.path);
              if (filter.length === 0){
                  newFiles.push(each);
              }
          }
          this.setState({ files: newFiles });
      }
  }

  _onDragOver = (e) => {
    let event = e;
    event.stopPropagation();
    event.preventDefault();
  }

  _onDragEnter = (e) => {
    let event = e;
    event.stopPropagation();
  }

  _removeFile = (path) => {
    const newList = this.state.files.filter(el => el.path !== path);
    this.setState({ files: newList });
  }

  _onClickConvert = () => {
    const _that = this;
    this.setState({ converting : true });
    const inputStreams = [];
    for (let each of this.state.files) {
        const stream = fs.createReadStream(each.path);
        inputStreams.push(stream);
    }
    fs.mkdir('./tmp', { recursive: true }, _err => {
        const outputPath = `./tmp/questionnaire_data_converted_${new Date().toISOString()}.tsv`;
        const outputStream = fs.createWriteStream(outputPath);
        const transformer = new QuestionnaireDataTransformer(inputStreams, outputStream);
        transformer.convert().then(() => {
            _that.setState({ converting: false, downloadPath: outputPath });
        }).catch(e => {
            _that.setState({ converting: false, error: JSON.stringify(e)});
        });
    })
  }

  render() {
      return <div>
          <div
            style={{ background: '#414141', width: '100%', height: '200px', border: '1px solid', padding: '1rem' }}
            onDrop={this._onDrop}
            onDragOver={this._onDragOver}
            onDragEnter={this._onDragEnter}
          >
            {this.state.files.map(el => <OneFile file={el} key={el.path} removeFunc={this._removeFile}/>)}
          </div><br/>
          <button className="function-button" onClick={this.state.converting ? () => {} : this._onClickConvert}>{ this.state.converting ? 'Loading' : 'Convert'}</button> 
          { this.state.downloadPath ? <button className="function-button" onClick={this._onClickConvert}>Download</button> : null }
      </div>;
  }
}

class OneFile extends React.Component {
    render() {
        return <div style={{  margin: '0.5rem 0 0.5rem 0', position: 'relative', background: '#212121', width: '100%', height: '40px', overflow: 'hidden', lineHeight: '40px', padding: '0 1rem 0 1rem', boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.3)' }}>
            {this.props.file.name}
            <span style={{ right: '1rem', position: 'absolute', cursor: 'pointer' }} onClick={e => this.props.removeFunc(this.props.file.path)}>X</span>
        </div>;
    }
}


const domContainer = document.querySelector('#react-questionnaire-normalise');
ReactDOM.render(<QuestionnaireConvert/>, domContainer);