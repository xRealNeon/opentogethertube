<template>
  <div class="d-flex flex-column">
    <div class="chat-header d-flex flex-row">
      <v-btn
        icon
        x-small
        @click="$emit('close')"
      >
        <v-icon>fas fa-chevron-right</v-icon>
      </v-btn>
      <h4>{{ $t("chat.title") }}</h4>
    </div>
    <div
      ref="messages"
      @scroll="onScroll"
      class="messages d-flex flex-column flex-grow-1 mt-2"
    >
      <transition-group name="message">
        <div
          class="message"
          v-for="(msg, index) in $store.state.room.chatMessages"
          :key="index"
        >
          <div class="from">{{ msg.from.name }}</div>
          <div class="text"><ProcessedText :text="msg.text" /></div>
        </div>
      </transition-group>
    </div>
    <div class="d-flex justify-end">
      <v-text-field
        :placeholder="$t('chat.type-here')"
        @keydown="onInputKeyDown"
        v-model="inputValue"
        autocomplete="off"
      />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import ProcessedText from "@/components/ProcessedText.vue";
import api from "@/util/api";
import Component from 'vue-class-component';

@Component({
  name: "Chat",
  components: {
    ProcessedText,
  },
  data() {
    return {
      inputValue: "",
      api,
    };
  },
})
export default class Chat extends Vue {
  inputValue = ""
  stickToBottom = true

  updated() {
    if (this.stickToBottom) {
      const div = this.$refs["messages"] as Element;
      div.scrollTop = div.scrollHeight;
    }
  }

  onInputKeyDown(e) {
    if (e.key === "Enter" && this.inputValue.trim() !== "") {
      api.chat(this.inputValue);
      this.inputValue = "";
      this.stickToBottom = true;
    }
  }

  onScroll() {
    const div = this.$refs["messages"] as Element;
    const distToBottom = div.scrollHeight - div.clientHeight - div.scrollTop;
    this.stickToBottom = distToBottom === 0;
  }
}
</script>

<style lang="scss" scoped>
.chat-header {
  border-bottom: 1px solid #666;
}

.messages {
  overflow-y: auto;
  overflow-x: hidden;

  flex-basis: 0;
  align-items: baseline;
}

.message {
  margin: 4px;
  padding: 3px;

  &:first-child {
    margin-top: auto;
  }

  .from,
  .text {
    display: inline;
    margin: 3px 5px;
    word-wrap: break-word;
  }

  .from {
    font-weight: bold;
  }
}

// Transition animation
.message-enter-active, .message-leave-active {
  transition: all 0.2s;
}
.message-enter, .message.leave-to {
  opacity: 0;
  transform: translateX(-30px) scaleY(0);
}
.message-move {
  transition: transform 0.2s;
}
</style>
