import React from 'react';
import { ClientConnector } from 'redux-collaborative-state/dist/client/ClientConnector';
import './App.css';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { setConnector } from './app/store';
import { add } from './features/todo/todoSlice';

function App() {
  const state = useAppSelector(state => state);
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    const connectorPromise = ClientConnector.connect({
      clientId: "georch",
      sessionId: "someSession"
    }, dispatch);

    connectorPromise.then(setConnector)

    return () => {
      connectorPromise.then(connector => {
        connector.webSocket.close(4000, "Component exited")
        setConnector(undefined);
      });
    }
  }, [dispatch]);

  return (
    <div className="App">
      App state:
      <br />
      <ObjectDisplay obj={state} />
      {/* <Counter /> */}
      <button onClick={() => dispatch(add({ participant: "georch", text: "whatever" }))}>Click me!</button>
    </div>
  );
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
