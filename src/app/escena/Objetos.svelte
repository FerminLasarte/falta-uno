<!--
  Lo que hay alrededor del teléfono, siempre desde arriba. Pocas piezas y de
  bajo contraste: están para dar contexto, no para competir con la pantalla.
  Todas tiran sombra hacia abajo a la derecha, coherentes con el tubo de luz.
-->
<script lang="ts">
  // Sin lógica: es puro dibujo. El script vacío lo marca como TypeScript.
</script>

<div class="objetos" aria-hidden="true">
  <div class="mate">
    <div class="boca"></div>
    <div class="bombilla"></div>
  </div>

  <div class="llaves">
    <span class="aro"></span>
    <span class="llave l1"></span>
    <span class="llave l2"></span>
  </div>

  <div class="vaso"></div>
</div>

<style>
  .objetos {
    position: absolute;
    inset: 0;
    filter: brightness(var(--luz));
  }

  .mate {
    position: absolute;
    left: 7%;
    top: 24%;
    width: 152px;
    height: 152px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 30% 26%, #7A5330 0%, #4C331D 58%, #2E1F0F 100%);
    border: 1px solid rgb(0 0 0 / 35%);
    box-shadow:
      18px 24px 30px -10px rgb(0 0 0 / 70%),
      4px 6px 10px -2px rgb(0 0 0 / 55%);
  }
  /* La yerba llena casi toda la boca y está apelmazada, no es una pelota verde. */
  .boca {
    position: absolute;
    inset: 9%;
    border-radius: 50%;
    background:
      radial-gradient(circle at 62% 68%, #3C5322 0%, #2E4019 46%, #22300F 100%),
      radial-gradient(circle at 36% 32%, #5A6E33 0%, transparent 58%);
    box-shadow:
      inset 0 3px 8px rgb(0 0 0 / 62%),
      inset 0 -1px 0 rgb(255 255 255 / 6%);
  }
  /* El montoncito de yerba corrido hacia un lado, como queda de verdad. */
  .boca::after {
    content: "";
    position: absolute;
    inset: 14% 40% 44% 12%;
    border-radius: 54% 46% 40% 60% / 60% 50% 50% 40%;
    background: #64783A;
    opacity: 0.5;
    filter: blur(3px);
  }
  .bombilla {
    position: absolute;
    top: 22%;
    left: 46%;
    width: 128px;
    height: 10px;
    border-radius: 4px;
    background: linear-gradient(180deg, #C9CDD2 0%, #8B9096 55%, #62666B 100%);
    transform: rotate(-27deg);
    transform-origin: left center;
    box-shadow: 6px 9px 12px -4px rgb(0 0 0 / 50%);
  }

  .llaves {
    position: absolute;
    right: 9%;
    bottom: 19%;
    width: 190px;
    height: 140px;
    filter: drop-shadow(11px 14px 11px rgb(0 0 0 / 62%));
  }
  .aro {
    position: absolute;
    top: 10px;
    left: 12px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 3px solid #9AA0A6;
  }
  .llave {
    position: absolute;
    width: 98px;
    height: 12px;
    border-radius: 3px;
    background: linear-gradient(180deg, #A8AEB4 0%, #7D8288 60%, #5C6166 100%);
  }
  .l1 { top: 26px; left: 56px; transform: rotate(16deg); }
  .l2 { top: 48px; left: 53px; transform: rotate(38deg); }

  .vaso {
    position: absolute;
    right: 14.5%;
    top: 17%;
    width: 124px;
    height: 124px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 38% 32%, rgb(255 255 255 / 22%) 0%, transparent 55%),
      radial-gradient(circle, rgb(196 214 220 / 16%) 0%, rgb(140 160 170 / 10%) 100%);
    border: 2px solid rgb(226 238 242 / 22%);
    box-shadow:
      14px 18px 24px -8px rgb(0 0 0 / 60%),
      3px 4px 8px -1px rgb(0 0 0 / 45%);
  }
</style>
