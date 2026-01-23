#!/bin/bash

tmux split-window -h \
  && tmux split-window -v -t 1 \
  && tmux split-window -v -t 1 \
  && tmux select-pane -t 0
