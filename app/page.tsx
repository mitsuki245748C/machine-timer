const machines = [
  { id: 1, name: "スミスマシン", status: "空き" },
  { id: 2, name: "ベンチプレス", status: "使用中" },
  { id: 3, name: "ラットプルダウン", status: "空き" },
  { id: 4, name: "レッグプレス", status: "空き" },
];

export default function Home() {
  return (
    <div className="home">
      <header className="banner">Machine Timer</header>
      <main className="machine-panel" aria-label="Machine Timer">
        <h1>Machine Timer</h1>
        <div className="machine-list">
          {machines.map((machine) => (
            <div key={machine.id} className="machine">
              <h2>{machine.name}</h2>
              <p>Status: {machine.status}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}