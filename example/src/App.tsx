import { Dispatch } from '@reduxjs/toolkit';
import React from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import { BrowserRouter } from 'react-router-dom';
import { connect, ConnectActionPayload } from 'redux-collaborative-state/dist/client/connectionSlice';
import './App.css';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { connector } from './app/store';
import { add } from './features/todo/todoSlice';

function App() {
  const state = useAppSelector(state => state);
  const dispatch = useAppDispatch();

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/session/:sessionId" element={<RoutedConnection />} />
          <Route path="/session/~new" element={<NewConnection />} />
          <Route path="/" element={<NoConnection />} />
        </Routes>
      </BrowserRouter>

      App state:
      <br />
      <ObjectDisplay obj={state} />
      <button onClick={() => state.connection.type === "active" && dispatch(add({
        participant: state.connection.clientId,
        text: "whatever"
      }))}>Click me !</button>
    </div>
  );
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
    connector.setTargetState({});
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
    connector.setTargetState({ sessionId, clientId })
  },
    [clientId, sessionId, dispatch]);

  return <></>
}

function NoConnection() {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    connector.setTargetState("disconnected");
    connector.dispatch = dispatch;
  }, [dispatch]);

  return <></>
}

function ObjectDisplay(props: { obj: any }) {
  const { obj } = props;
  if (typeof obj === "object") {
    return <div className="object" >{Object.entries(obj).map(([k, v]) => <div key={k}>
      <div className="key">{k}</div>
      <ObjectDisplay obj={v} />
    </div>)}</div>
  }
  return <div className="literal">{`${obj}`}</div>
}

export default App;
