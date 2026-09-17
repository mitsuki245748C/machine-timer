"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { useStopwatches } from "../stopwatch/use-stopwatches";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);

  return `${minutes.toString().padStart(2, "0")}:${(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

// 1セット分のデータ
type SetData = {
  weight: string;
  reps: string;
};

function HistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URLからidを取得
  const machineId = Number(searchParams.get("machineId"));

  const { data, sendAction, pending } = useStopwatches();

  // そのidのマシンだけ抜き出す
  const state = data?.machines.find(({ id }) => id === machineId)?.state;

  // セットの一覧
  const [sets, setSets] = useState<SetData[]>([
    {
      weight: "",
      reps: "",
    },
  ]);

  // 重量を変更
  const handleWeightChange = (index: number, value: string) => {
    setSets(
      sets.map((set, i) =>
        i === index
          ? { ...set, weight: value }
          : set
      )
    );
  };

  // 回数を変更
  const handleRepsChange = (index: number, value: string) => {
    setSets(
      sets.map((set, i) =>
        i === index
          ? { ...set, reps: value }
          : set
      )
    );
  };

  // セットを追加
  const addSet = () => {
    setSets([
      ...sets,
      {
        weight: "",
        reps: "",
      },
    ]);
  };

  // 終了ボタン
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    console.log({
      machineId,
      sets,
    });

    try {
      // 器具のステータスを「空き」に変更
      const response = await fetch(
        `/api/machines/${machineId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "空き",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("器具のステータス更新に失敗しました。");
      }

      // タイマーをリセット
      await sendAction("reset", machineId);

      // リセット完了後、トップページへ戻る
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="home">
      <header className="banner">Machine Timer</header>

      <main className="machine-panel" aria-label="Machine Timer">
        <h1>トレーニング記録</h1>

        <p style={{ color: "#a1a1aa", margin: 0 }}>
          No pain, No gain
        </p>

        <p
          style={{
            fontSize: "3.5rem",
            fontFamily: "monospace",
            color: "#e11d48",
            margin: "1rem 0",
          }}
        >
          {state ? formatTime(state.seconds) : "--:--"}
        </p>

        {state?.isReserved && (
          <p className="machine-notice">
            予約されています。長時間の利用はおやめください。
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {sets.map((set, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              {/* セット数の見出し */}
              <h3
                style={{
                  margin: "0 0 12px 0",
                  color: "#ffffff",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  borderBottom: "1px solid #27272a",
                  paddingBottom: "6px",
                }}
              >
                {index + 1}セット目
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: "16px",
                }}
              >
                {/* 重量入力エリア */}
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#ffffff",
                      marginBottom: "4px",
                    }}
                  >
                    重量
                  </label>

                  <input
                    type="number"
                    value={set.weight}
                    onChange={(e) =>
                      handleWeightChange(
                        index,
                        e.target.value
                      )
                    }
                    placeholder="kg"
                    style={{
                      width: "100%",
                      padding: "8px",
                      backgroundColor: "#27272a",
                      color: "#ffffff",
                      border: "1px solid #3f3f46",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* 回数入力エリア */}
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#ffffff",
                      marginBottom: "4px",
                    }}
                  >
                    回数
                  </label>

                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) =>
                      handleRepsChange(
                        index,
                        e.target.value
                      )
                    }
                    placeholder="回"
                    style={{
                      width: "100%",
                      padding: "8px",
                      backgroundColor: "#27272a",
                      color: "#ffffff",
                      border: "1px solid #3f3f46",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* ボタン配置エリア */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={addSet}
              style={{
                flex: 1,
                padding: "10px 16px",
                backgroundColor: "#27272a",
                color: "#e4e4e7",
                border: "1px solid #3f3f46",
                borderRadius: "6px",
                fontSize: "0.95rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ＋ セットを追加
            </button>

            <button
              type="submit"
              disabled={pending}
              style={{
                flex: 1,
                padding: "10px 16px",
                backgroundColor: "#e11d48",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {pending ? "終了処理中..." : "終了"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function History() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}