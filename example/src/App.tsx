import { Dispatch } from '@reduxjs/toolkit';
import React, { memo } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import { BrowserRouter, Link } from 'react-router-dom';
import { connect, ConnectActionPayload } from 'redux-collaborative-state/dist/client/connectionSlice';
import './App.css';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { connector } from './app/store';
import { Chat } from './features/chat/Chat';
import { add } from './features/todo/todoSlice';

function App() {

  const [displayState, setDisplayState] = React.useState(false);

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/session/:sessionId" element={<RoutedConnection />} />
          <Route path="/session/~new" element={<NewConnection />} />
          <Route path="/" element={<NoConnection />} />
        </Routes>
      </BrowserRouter>

      <br />

      <input type="checkbox" checked={displayState} onChange={e => setDisplayState(e.currentTarget.checked)} />
      Display App state
      {displayState && <>
        <br />
        <StateDisplay />
        <AddItemComponent />
      </>}

    </div>
  );
}

function StateDisplay() {
  const state = useAppSelector(state => state);
  return <ValueDisplay value={state} />
}

function AddItemComponent() {
  const clientId = useAppSelector(state => state.connection.type === "active" && state.connection.clientId);
  const dispatch = useAppDispatch();
  const submit = () => {
    if (!clientId) return;
    dispatch(add({
      participant: clientId,
      text
    }));
    setText("");
  };

  const [text, setText] = React.useState("");

  return <div>
    <input type="text" value={text} onChange={e => setText(e.target.value)}
      onKeyPress={e => e.key === "Enter" && submit()} />
    <button onClick={submit}>Add</button>
  </div>
}

function NewConnection() {
  const originalDispatch = useAppDispatch();
  const navigate = useNavigate();
  const dispatch: Dispatch = React.useCallback(action => {
    if (action.type === connect.type) {
      const { sessionId } = action.payload as ConnectActionPayload;
      navigate(`/session/${sessionId}`);
    }
    return originalDispatch(action);
  }, [originalDispatch, navigate]);

  React.useEffect(() => {
    connector.dispatch = dispatch;
    connector.connect();
    return () => {
      connector.dispatch = originalDispatch;
    };
  }, [dispatch, originalDispatch]);

  return <></>
}

function RoutedConnection() {
  const { sessionId, clientId } = useParams();
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    connector.dispatch = dispatch;
    connector.connect(sessionId, clientId)
  },
    [clientId, sessionId, dispatch]);

  return <>
    <Chat />
  </>
}

function NoConnection() {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    connector.disconnect();
    connector.dispatch = dispatch;
  }, [dispatch]);

  return <>
    <Link to="/session/~new">Create new session</Link>
  </>
}

function ValueDisplay(props: { value: any }) {
  const { value: obj } = props;
  if (obj === null) {
    return <div className="literal">null</div>
  }
  else if (obj === undefined) {
    return <div className="literal">undefined</div>
  }
  else if (typeof obj === "object") {
    return <MemoizedObjectDisplay obj={obj} />
  }
  else
    return <div className="literal">{`${obj}`}</div>
}

const MemoizedObjectDisplay = memo(ObjectDisplay);

function ObjectDisplay(props: { obj: object }) {
  return <div className="object" >{Object.entries(props.obj).map(([k, v]) => <div key={k}>
    <div className="key">{k}</div>
    <ValueDisplay value={v} />
  </div>)}</div>
}

export default App;
