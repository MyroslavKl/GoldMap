/**
 * Реалізація GlobeView для розробки: MapLibre GL JS у react-native-webview.
 * Працює в Expo Go, повністю офлайн (HTML з даними вшитий у бандл).
 * Перед публікацією замінюється на нативний @rnmapbox/maps — див. docs/SPEC.md.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { getCountry } from '@/data/countries';
import { colors } from '@/theme';

import { isFromWebMessage, WEB_RECEIVER, type ToWebMessage } from './protocol';
import type { FlyToTarget, GlobeViewHandle, GlobeViewProps } from './types';
import { GLOBE_HTML } from './web/globe-html.generated';

/** У react-native-webview 14 `WebView<P = undefined>` дає `Props & undefined` = never під TS 6 — задаємо P явно. */
type NoExtraProps = Record<never, never>;
type GlobeWebView = WebView<NoExtraProps>;

const SOURCE = { html: GLOBE_HTML };
const COUNTRY_ZOOM = 3;
const POINT_ZOOM = 5;

export function GlobeView({
  visited,
  planned = [],
  autoRotate = true,
  onCountryPress,
  onInteraction,
  onReady,
  style,
  ref,
}: GlobeViewProps & { ref?: Ref<GlobeViewHandle> }) {
  const webview = useRef<GlobeWebView>(null);
  const [ready, setReady] = useState(false);

  const send = useCallback((message: ToWebMessage) => {
    webview.current?.injectJavaScript(
      `window.${WEB_RECEIVER}&&window.${WEB_RECEIVER}(${JSON.stringify(message)});true;`,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(target: FlyToTarget) {
        if ('iso2' in target) {
          const country = getCountry(target.iso2);
          if (!country) return;
          send({ type: 'flyTo', lat: country.lat, lng: country.lng, zoom: COUNTRY_ZOOM });
        } else {
          send({
            type: 'flyTo',
            lat: target.lat,
            lng: target.lng,
            zoom: target.zoom ?? POINT_ZOOM,
          });
        }
      },
    }),
    [send],
  );

  // Ключі як рядки — щоб не перевідправляти той самий стан на кожен рендер.
  const visitedKey = [...visited].sort().join(',');
  const plannedKey = [...planned].sort().join(',');
  useEffect(() => {
    if (!ready) return;
    send({
      type: 'setCountries',
      visited: visitedKey ? visitedKey.split(',') : [],
      planned: plannedKey ? plannedKey.split(',') : [],
    });
  }, [ready, visitedKey, plannedKey, send]);

  useEffect(() => {
    if (ready) send({ type: 'setAutoRotate', enabled: autoRotate });
  }, [ready, autoRotate, send]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: unknown;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!isFromWebMessage(message)) return;
      switch (message.type) {
        case 'ready':
          setReady(true);
          onReady?.();
          break;
        case 'countryPress':
          onCountryPress?.(message.iso2);
          break;
        case 'interaction':
          onInteraction?.();
          break;
        case 'error':
          if (__DEV__) console.warn('[globe]', message.message);
          break;
      }
    },
    [onCountryPress, onInteraction, onReady],
  );

  return (
    <View style={[styles.root, style]}>
      <WebView<NoExtraProps>
        ref={webview}
        source={SOURCE}
        originWhitelist={['*']}
        onMessage={onMessage}
        style={[styles.webview, !ready && styles.hidden]}
        containerStyle={styles.webview}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowsLinkPreview={false}
        textInteractionEnabled={false}
        androidLayerType="hardware"
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hidden: {
    opacity: 0,
  },
});
