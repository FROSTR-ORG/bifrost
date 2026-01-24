#!/bin/bash

SESSION_NAME="bifrost-demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Find an available terminal emulator
find_terminal() {
  for term in gnome-terminal konsole xfce4-terminal mate-terminal alacritty kitty xterm; do
    if command -v "$term" &>/dev/null; then
      echo "$term"
      return
    fi
  done
  echo ""
}

# Launch a command in a new terminal window
# Uses 200 columns x 50 rows for a wider window
launch_in_terminal() {
  local term="$1"
  local cmd="$2"

  case "$term" in
    gnome-terminal)
      gnome-terminal --geometry=200x50 -- bash -c "$cmd"
      ;;
    konsole)
      konsole --geometry 200x50 -e bash -c "$cmd"
      ;;
    xfce4-terminal)
      xfce4-terminal --geometry=200x50 -e "bash -c '$cmd'"
      ;;
    mate-terminal)
      mate-terminal --geometry=200x50 -e "bash -c '$cmd'"
      ;;
    alacritty)
      alacritty -o 'window.dimensions.columns=200' -o 'window.dimensions.lines=50' -e bash -c "$cmd"
      ;;
    kitty)
      kitty -o initial_window_width=200c -o initial_window_height=50c bash -c "$cmd"
      ;;
    xterm)
      xterm -geometry 200x50 -e bash -c "$cmd"
      ;;
    *)
      echo "Error: No supported terminal emulator found"
      exit 1
      ;;
  esac
}

# Create the tmux session with demo panes
create_session() {
  cd "$PROJECT_DIR"

  # Create new tmux session with relay in first pane
  tmux new-session -d -s "$SESSION_NAME" -n demo 'clear && npm run demo:relay'

  # Split right side and run alice
  tmux split-window -h -t "$SESSION_NAME" 'clear && npm run script demo/node.ts -- --name alice'

  # Split alice pane for bob
  tmux split-window -v -t "$SESSION_NAME:demo.1" 'clear && npm run script demo/node.ts -- --name bob'

  # Split bob pane for carol
  tmux split-window -v -t "$SESSION_NAME:demo.2" 'clear && npm run script demo/node.ts -- --name carol'

  # Select alice pane
  tmux select-pane -t "$SESSION_NAME:demo.1"

  # Attach to session
  tmux attach-session -t "$SESSION_NAME"
}

case "$1" in
  start)
    # Stop existing session if running
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "Stopping existing session..."
      tmux kill-session -t "$SESSION_NAME" 2>/dev/null
      sleep 0.5
    fi

    # Clear log files
    LOG_DIR="$PROJECT_DIR/demo/logs"
    if [ -d "$LOG_DIR" ]; then
      rm -f "$LOG_DIR"/*.log
      echo "Cleared log files"
    fi

    # Check if we're already in tmux OR launched from terminal (second stage)
    if [ -n "$TMUX" ] || [ "$BIFROST_LAUNCH" = "1" ]; then
      create_session
    else
      # Try to launch in a new terminal window
      TERM_EMU=$(find_terminal)
      if [ -n "$TERM_EMU" ]; then
        echo "Launching in $TERM_EMU..."
        launch_in_terminal "$TERM_EMU" "BIFROST_LAUNCH=1 '$0' start"
      else
        echo "Error: No terminal emulator found and not running in tmux"
        echo "Install gnome-terminal, konsole, xterm, or run this script from within tmux"
        exit 1
      fi
    fi
    ;;
  stop)
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null
    echo "Session '$SESSION_NAME' stopped"
    ;;
  *)
    echo "Usage: $0 {start|stop}"
    echo ""
    echo "Commands:"
    echo "  start  - Clear logs and (re)start demo session with relay + alice/bob/carol"
    echo "  stop   - Kill the demo session"
    ;;
esac
