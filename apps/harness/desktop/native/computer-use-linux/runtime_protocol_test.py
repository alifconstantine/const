import io
import json
import os
import unittest
from contextlib import ExitStack
from unittest.mock import Mock, patch

from runtime_render_test import load_runtime

runtime = load_runtime()


class RuntimeProtocolTests(unittest.TestCase):
    def test_serve_announces_ready_and_correlates_sequential_requests(self):
        stream = io.StringIO('\n{"tool":"handshake","requestId":1}\n{"tool":"list_apps","requestId":2}\n')
        output = io.StringIO()
        with patch.object(runtime, "ensure_desktop_bus"), patch.object(runtime, "run_operation", side_effect=[{"ok": True}, {"ok": True, "apps": []}]) as operation:
            runtime.serve(stream, output)
        responses = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(responses, [{"ready": True}, {"ok": True, "requestId": 1}, {"ok": True, "apps": [], "requestId": 2}])
        self.assertEqual(operation.call_count, 2)

    def test_action_error_does_not_shift_following_response_ids(self):
        stream = io.StringIO('{"tool":"click","requestId":1}\n{"tool":"handshake","requestId":2}\n')
        output = io.StringIO()
        with patch.object(runtime, "ensure_desktop_bus"), patch.object(runtime, "run_operation", side_effect=[RuntimeError("focus failed"), {"ok": True}]):
            runtime.serve(stream, output)
        responses = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(responses[1], {"ok": False, "error": "focus failed", "requestId": 1})
        self.assertEqual(responses[2]["requestId"], 2)

    def test_malformed_json_returns_its_recoverable_request_id(self):
        output = io.StringIO()
        with patch.object(runtime, "ensure_desktop_bus"):
            runtime.serve(io.StringIO('{"requestId":7, broken}\n'), output)
        response = json.loads(output.getvalue().splitlines()[1])
        self.assertFalse(response["ok"])
        self.assertEqual(response["requestId"], 7)

    def test_missing_desktop_session_never_announces_readiness(self):
        output = io.StringIO()
        with patch.object(runtime, "ensure_desktop_bus", side_effect=RuntimeError("missing desktop")):
            with self.assertRaisesRegex(RuntimeError, "missing desktop"):
                runtime.serve(io.StringIO(), output)
        self.assertEqual(output.getvalue(), "")

    def test_wayland_capabilities_do_not_advertise_unsupported_global_input(self):
        with patch.dict(os.environ, {"XDG_SESSION_TYPE": "wayland"}), patch.object(runtime.shutil, "which", return_value="/usr/bin/tool"):
            capabilities = runtime.handshake_response()["supports"]
        for name in ("typeText", "pressKey", "hotkey", "pasteText"):
            self.assertFalse(capabilities["actions"][name])
        self.assertFalse(capabilities["observation"]["screenshot"])

    def test_wayland_hotkey_does_not_attempt_xdotool(self):
        with patch.dict(os.environ, {"XDG_SESSION_TYPE": "wayland"}), patch.object(runtime.subprocess, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "unsupported_capability"):
                runtime.hotkey("Ctrl+F")
        run.assert_not_called()

    def test_failed_native_pointer_event_is_reported(self):
        with patch.dict(os.environ, {"XDG_SESSION_TYPE": "x11"}), patch.object(runtime.Atspi, "generate_mouse_event", return_value=False, create=True):
            with self.assertRaisesRegex(RuntimeError, "input_delivery_failed"):
                runtime.checked_mouse_event(10, 20, "b1p")

    def test_window_coordinates_reject_nonfinite_and_out_of_bounds_points(self):
        bounds = runtime.Rect(100, 200, 800, 600)
        self.assertEqual(runtime.screen_point(bounds, x=20, y=30), (120, 230))
        for x, y in ((-1, 0), (800, 0), (0, float("nan")), (float("inf"), 0)):
            with self.assertRaisesRegex(RuntimeError, "invalid_coordinates"):
                runtime.screen_point(bounds, x=x, y=y)

    def test_successfully_delivered_input_is_not_reclassified_as_failed_when_observation_fails(self):
        with ExitStack() as stack:
            for name, value in (("find_app", object()), ("choose_window", (0, object())), ("screen_rect", runtime.Rect(0, 0, 100, 100)), ("find_element", None)):
                stack.enter_context(patch.object(runtime, name, return_value=value))
            stack.enter_context(patch.object(runtime, "require_keyboard_focus"))
            delivery = stack.enter_context(patch.object(runtime, "type_text"))
            stack.enter_context(patch.object(runtime, "make_snapshot", side_effect=RuntimeError("window closed")))
            result = runtime.run_operation({"tool": "type_text", "app": "test", "text": "hello"})
        delivery.assert_called_once_with("hello")
        self.assertTrue(result["ok"])
        self.assertIsNone(result["snapshot"])
        self.assertEqual(result["action"]["verification"]["state"], "unverified")
        self.assertEqual(result["observationError"], "window closed")

    def test_drag_releases_button_when_a_movement_fails(self):
        calls = []
        def event(x, y, name):
            calls.append(name)
            if len(calls) == 3:
                raise RuntimeError("movement failed")
        with patch.object(runtime, "checked_mouse_event", side_effect=event), patch.object(runtime.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "movement failed"):
                runtime.drag_between((1, 2), (10, 20))
        self.assertEqual(calls[-1], "b1r")


if __name__ == "__main__":
    unittest.main()
