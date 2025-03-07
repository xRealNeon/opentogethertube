<template>
  <v-app id="app">
    <v-app-bar app :absolute="!$store.state.fullscreen" :inverted-scroll="$store.state.fullscreen">
      <v-app-bar-nav-icon @click="drawer = true" />
      <v-img :src="require('@/assets/logo.svg')" max-width="32" max-height="32" contain style="margin-right: 8px" />
      <v-toolbar-title>
        <router-link class="link-invis" style="margin-right: 10px" to="/">
          OpenTogetherTube
        </router-link>
      </v-toolbar-title>
      <v-toolbar-items v-if="$vuetify.breakpoint.lgAndUp">
        <v-btn text to="/rooms">{{ $t("nav.browse") }}</v-btn>
        <v-btn text to="/faq">{{ $t("nav.faq") }}</v-btn>
        <v-btn text href="https://github.com/dyc3/opentogethertube/issues/new/choose" target="_blank">
          <v-icon class="side-pad">fas fa-bug</v-icon>
          {{ $t("nav.bug") }}
        </v-btn>
        <v-btn text href="https://github.com/sponsors/dyc3" target="_blank">
          <v-icon class="side-pad">fas fa-heart</v-icon>
          {{ $t("nav.support") }}
        </v-btn>
      </v-toolbar-items>
      <v-spacer />
      <v-toolbar-items v-if="$vuetify.breakpoint.lgAndUp">
        <v-menu offset-y>
          <template v-slot:activator="{ on }">
            <v-btn text v-on="on">
              <v-icon class="side-pad">fas fa-plus-square</v-icon>
              {{ $t("nav.create.title") }}
            </v-btn>
          </template>
          <v-list two-line max-width="400">
            <NavCreateRoom @createtemp="createTempRoom" @createperm="showCreateRoomForm = true" />
          </v-list>
        </v-menu>
        <NavUser @login="showLogin = true" @logout="logout" />
        <v-select
          solo
          flat
          style="margin-top: 5px; width: 100px"
          :items="locales"
          @change="setLocale"
          :value="$i18n.locale"
        />
      </v-toolbar-items>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer" absolute temporary>
      <v-list nav dense>
        <v-list-item-group>
          <v-list-item to="/">
            <v-list-item-content>
              {{ $t("nav.home") }}
            </v-list-item-content>
          </v-list-item>
          <v-list-item to="/rooms">
            <v-list-item-content>
              {{ $t("nav.browse") }}
            </v-list-item-content>
          </v-list-item>
          <v-list-item to="/faq">
            <v-list-item-content>
              {{ $t("nav.faq") }}
            </v-list-item-content>
          </v-list-item>
          <v-list-item href="https://github.com/dyc3/opentogethertube/issues/new/choose" target="_blank">
            <v-list-item-icon>
              <v-icon>fas fa-bug</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              {{ $t("nav.bug") }}
            </v-list-item-content>
          </v-list-item>
          <v-list-item href="https://github.com/sponsors/dyc3" target="_blank">
            <v-list-item-icon>
              <v-icon>fas fa-heart</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              {{ $t("nav.support") }}
            </v-list-item-content>
          </v-list-item>
          <NavCreateRoom @createtemp="createTempRoom" @createperm="showCreateRoomForm = true" />
          <NavUser @login="showLogin = true" @logout="logout" />
          <v-select
            solo
            flat
            :items="locales"
            @change="setLocale"
            :value="$i18n.locale"
          />
        </v-list-item-group>
      </v-list>
      <template v-slot:append>
        <div class="pa-2">
          <NavUser @login="showLogin = true" @logout="logout" />
        </div>
      </template>
    </v-navigation-drawer>
    <v-main>
      <router-view/>
    </v-main>
    <v-container>
      <v-dialog v-model="showCreateRoomForm" persistent max-width="600">
        <CreateRoomForm @roomCreated="showCreateRoomForm = false" @cancel="showCreateRoomForm = false" />
      </v-dialog>
    </v-container>
    <v-container>
      <v-dialog v-model="showLogin" max-width="600">
        <LogInForm @shouldClose="showLogin = false" />
      </v-dialog>
    </v-container>
    <v-overlay :value="isLoadingCreateRoom">
      <v-container fill-height>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="4">
            <v-progress-circular indeterminate />
            <v-btn elevation="12" x-large @click="cancelRoom" style="margin-top: 24px">{{ $t("actions.cancel") }}</v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-overlay>
    <Notifier />
  </v-app>
</template>

<script lang="ts">
import Vue from "vue";
import { API } from "@/common-http.js";
import CreateRoomForm from "@/components/CreateRoomForm.vue";
import LogInForm from "@/components/LogInForm.vue";
import RoomUtilsMixin from "@/mixins/RoomUtils.js";
import NavUser from "@/components/navbar/NavUser.vue";
import NavCreateRoom from "@/components/navbar/NavCreateRoom.vue";
import Notifier from "@/components/Notifier.vue";
import { loadLanguageAsync } from "@/i18n";

export default Vue.extend({
  name: "app",
  components: {
    CreateRoomForm,
    LogInForm,
    NavUser,
    NavCreateRoom,
    Notifier,
  },
  mixins: [RoomUtilsMixin],
  data() {
    return {
      showCreateRoomForm: false,
      showLogin: false,
      drawer: false,

      locales: [
        {
          text: "🇺🇸",
          value: "en",
        },
      ],
    };
  },
  methods: {
    logout() {
      API.post("/user/logout").then(res => {
        if (res.data.success) {
          this.$store.commit("LOGOUT");
        }
      });
    },
    async setLocale(locale: string) {
      await loadLanguageAsync(locale);
      this.$store.commit("settings/UPDATE", { locale });
    },
  },
  async created() {
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        this.$store.state.fullscreen = true;
        document.querySelector("html")?.classList.add("scrollbarBeGone");
      }
      else {
        this.$store.state.fullscreen = false;
        document.querySelector("html")?.classList.remove("scrollbarBeGone");
      }
    });

    await this.$store.dispatch("settings/load");
    await this.$store.dispatch("getNewToken");
    await this.setLocale(this.$store.state.settings.locale);

    // ask the server if we are logged in or not, and update the client to reflect that status.
    let resp = await API.get("/user");
    if (resp.data.loggedIn) {
      let user = resp.data;
      delete user.loggedIn;
      this.$store.commit("LOGIN", user);
    }
  },
});
</script>

<style lang="scss">
@import "variables.scss";

.link-invis {
  text-decoration: none;
  color: inherit !important;
}

.side-pad {
  margin: 0 4px;
}

.text-muted {
  opacity: 0.7;
}

.scrollbarBeGone {
  -ms-overflow-style: none; // I think this is an old way to do this? Probably not ideal
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
